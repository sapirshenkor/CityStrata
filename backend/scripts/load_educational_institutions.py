"""Load educational institutions from Excel file into PostGIS"""

import argparse
import asyncio
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from shapely.geometry import Point

from app.core.database import init_db_pool, get_pool, close_db_pool


def _to_jsonable(v: Any) -> Any:
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if pd.isna(v) or v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (pd.Timestamp,)):
        return v.isoformat()
    # Convert to string and strip whitespace
    try:
        result = str(v).strip()
        return result if result else None
    except Exception:
        return None


async def main():
    parser = argparse.ArgumentParser(
        description="Load educational institutions from Excel into PostGIS"
    )
    parser.add_argument(
        "--excel", required=True, help="Path to Excel file (.xlsx or .xls)"
    )
    parser.add_argument(
        "--sheet",
        type=int,
        default=0,
        help="Sheet index or name (default: 0 for first sheet)",
    )
    parser.add_argument(
        "--batch", type=int, default=100, help="Batch size for inserts (default: 100)"
    )
    args = parser.parse_args()

    # 1) Resolve Excel file path
    excel_path = Path(args.excel)
    if not excel_path.is_absolute():
        # If relative path, try current dir first, then project root
        if not excel_path.exists():
            # Try relative to project root (parent of backend)
            script_dir = Path(__file__).parent
            project_root = script_dir.parent.parent
            potential_path = project_root / excel_path
            if potential_path.exists():
                excel_path = potential_path
            else:
                raise RuntimeError(
                    f"Excel file not found: {args.excel}\n"
                    f"Tried: {Path(args.excel).absolute()}\n"
                    f"Tried: {project_root / args.excel}"
                )
    else:
        if not excel_path.exists():
            raise RuntimeError(f"Excel file not found: {excel_path}")

    # 2) Load Excel file
    print(f"Loading Excel file: {excel_path}")
    try:
        df = pd.read_excel(excel_path, sheet_name=args.sheet)
    except Exception as e:
        raise RuntimeError(f"Failed to read Excel file: {e}")

    if df.empty:
        raise RuntimeError("Excel file is empty or sheet has no data")

    print(f"Loaded {len(df)} rows from Excel")

    # 3) Validate required columns exist
    required_columns = [
        "Institution Code",
        "Institution name",
        "lat",
        "lon",
        "stat_2022",
    ]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise RuntimeError(
            f"Missing required columns: {missing_columns}\n"
            f"Found columns: {list(df.columns)}"
        )

    # 4) Prepare rows
    rows = []
    skipped = []

    for idx, row in df.iterrows():
        # Extract required fields
        institution_code = _to_jsonable(row["Institution Code"])
        institution_name = _to_jsonable(row["Institution name"])
        lat_val = _to_jsonable(row["lat"])
        lon_val = _to_jsonable(row["lon"])
        stat_2022_val = _to_jsonable(row["stat_2022"])

        # Validate required fields
        if not institution_code:
            skipped.append((idx + 2, "missing Institution Code"))
            continue
        if not institution_name:
            skipped.append((idx + 2, "missing Institution name"))
            continue

        # Validate and convert lat/lon
        try:
            lat_float = float(lat_val) if lat_val is not None else None
            lon_float = float(lon_val) if lon_val is not None else None
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid lat/lon: {lat_val}/{lon_val}"))
            continue

        if lat_float is None or lon_float is None:
            skipped.append((idx + 2, "missing lat/lon"))
            continue

        # Validate lat/lon ranges
        if not (-90 <= lat_float <= 90):
            skipped.append((idx + 2, f"invalid latitude: {lat_float}"))
            continue
        if not (-180 <= lon_float <= 180):
            skipped.append((idx + 2, f"invalid longitude: {lon_float}"))
            continue

        # Validate stat_2022
        try:
            stat_2022_int = int(stat_2022_val) if stat_2022_val is not None else None
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid stat_2022: {stat_2022_val}"))
            continue

        if stat_2022_int is None:
            skipped.append((idx + 2, "missing stat_2022"))
            continue

        # Create Point geometry
        point = Point(lon_float, lat_float)
        location_wkt = point.wkt

        # Extract optional fields
        address = _to_jsonable(row.get("address"))
        full_address = _to_jsonable(row.get("full_address"))
        type_of_supervision = _to_jsonable(row.get("type of supervision"))
        type_of_education = _to_jsonable(row.get("type of education"))
        education_phase = _to_jsonable(row.get("education phase"))

        rows.append(
            (
                str(institution_code),
                str(institution_name),
                address,
                full_address,
                type_of_supervision,
                type_of_education,
                education_phase,
                location_wkt,
                lat_float,
                lon_float,
                stat_2022_int,
            )
        )

    if skipped:
        print(f"\nWarning: Skipped {len(skipped)} rows:")
        for row_num, reason in skipped[:10]:  # Show first 10
            print(f"  Row {row_num}: {reason}")
        if len(skipped) > 10:
            print(f"  ... and {len(skipped) - 10} more")

    if not rows:
        raise RuntimeError("No valid rows to insert")

    # 5) DB upsert
    await init_db_pool()
    pool = get_pool()

    sql = """
    INSERT INTO public.educational_institutions
      (institution_code, institution_name, address, full_address,
       type_of_supervision, type_of_education, education_phase,
       location, lat, lon, stat_2022)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7,
       ST_SetSRID(ST_GeomFromText($8), 4326), $9, $10, $11)
    ON CONFLICT (institution_code)
    DO UPDATE SET
      institution_name = excluded.institution_name,
      address = excluded.address,
      full_address = excluded.full_address,
      type_of_supervision = excluded.type_of_supervision,
      type_of_education = excluded.type_of_education,
      education_phase = excluded.education_phase,
      location = excluded.location,
      lat = excluded.lat,
      lon = excluded.lon,
      stat_2022 = excluded.stat_2022,
      imported_at = now();
    """

    inserted = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i in range(0, len(rows), args.batch):
                batch_rows = rows[i : i + args.batch]
                await conn.executemany(sql, batch_rows)
                inserted += len(batch_rows)
                print(f"Upserted {inserted}/{len(rows)} rows...")

    await close_db_pool()
    print(
        f"\nDone. Upserted total: {inserted} educational institutions from {excel_path}"
    )


if __name__ == "__main__":
    asyncio.run(main())
