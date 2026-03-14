"""
Load PCA-ready-for-clustering data from CSV into Supabase.
Target table: public.pca_ready_for_clustering
"""

import argparse
import asyncio
from pathlib import Path

import pandas as pd

from app.core.database import close_db_pool, get_pool, init_db_pool

COLUMNS = [
    "stat_2022",
    "PC_EDUCATION_1",
    "PC_EDUCATION_2",
    "PC_TOURISM_1",
    "PC_TOURISM_2",
    "PC_TOURISM_3",
    "PC_FOOD_1",
    "PC_FOOD_2",
    "PC_COMMUNITY_1",
    "PC_OSM_INFRA_1",
    "PC_OSM_INFRA_2",
    "PC_OSM_INFRA_3",
    "PC_RELIGIOUS_1",
    "PC_RELIGIOUS_2",
]


def _to_int(value) -> int | None:
    if pd.isna(value):
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _to_float(value) -> float | None:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


async def main():
    parser = argparse.ArgumentParser(
        description="Load PCA-ready-for-clustering data from CSV into Supabase"
    )
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    parser.add_argument(
        "--batch",
        type=int,
        default=100,
        help="Number of rows per transaction",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        if not csv_path.exists():
            project_root = Path(__file__).resolve().parent.parent.parent
            csv_path = project_root / args.csv
        else:
            csv_path = csv_path.resolve()
    if not csv_path.exists():
        raise RuntimeError(f"CSV file not found: {csv_path}")

    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path)

    if df.empty:
        print("CSV is empty. Exiting.")
        return

    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise RuntimeError(f"CSV missing columns: {missing}")

    rows = []
    skipped = 0
    for _, row in df.iterrows():
        stat = _to_int(row["stat_2022"])
        if stat is None:
            skipped += 1
            continue
        values = [stat]
        for col in COLUMNS[1:]:
            v = _to_float(row[col])
            if v is None:
                skipped += 1
                break
            values.append(v)
        else:
            rows.append(tuple(values))

    if skipped:
        print(f"Skipped {skipped} rows due to missing or invalid data.")

    if not rows:
        print("No valid rows to load. Exiting.")
        return

    await init_db_pool()
    pool = get_pool()

    placeholders = ", ".join(f"${i+1}" for i in range(len(COLUMNS)))
    columns_sql = ", ".join(COLUMNS)
    updates = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in COLUMNS if c != "stat_2022"
    )

    sql = f"""
    INSERT INTO public.pca_ready_for_clustering ({columns_sql})
    VALUES ({placeholders})
    ON CONFLICT (stat_2022)
    DO UPDATE SET {updates}, imported_at = NOW();
    """

    inserted = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i in range(0, len(rows), args.batch):
                batch = rows[i : i + args.batch]
                await conn.executemany(sql, batch)
                inserted += len(batch)
                print(f"Uploaded {inserted}/{len(rows)} rows...")

    await close_db_pool()
    print(f"\nDone. Loaded {inserted} rows into public.pca_ready_for_clustering.")


if __name__ == "__main__":
    asyncio.run(main())
