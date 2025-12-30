"""
Load Hotels listings from CSV file into PostGIS (hotels_listings table)

CSV columns order (expected):
[
  'hotelId','name','type','description','url','rating',
  'address/full','location/lat','location/lng','stat_2022'
]

Usage:
  python -m scripts.load_hotels_listings --csv data/hotels.csv --batch 200 --semel 2600

Notes:
- Upserts by hotelid (unique).
- Builds PostGIS point geometry from (lng, lat) in SRID 4326.
- Requires stat_2022 to exist in public.statistical_areas with semel_yish=2600 (default).
"""

import argparse
import asyncio
from pathlib import Path
from typing import Any, Optional

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
    try:
        s = str(v).strip()
        return s if s else None
    except Exception:
        return None


def _find_column(df: pd.DataFrame, possible_names: list[str]) -> Optional[str]:
    """Find a column by trying multiple possible names (case-insensitive, flexible)."""
    df_cols_lower = {col.lower().strip(): col for col in df.columns}
    for name in possible_names:
        name_lower = name.lower().strip()
        # Exact match
        if name_lower in df_cols_lower:
            return df_cols_lower[name_lower]
        # Partial match (contains)
        for col_lower, col in df_cols_lower.items():
            if name_lower in col_lower or col_lower in name_lower:
                return col
    return None


async def main():
    parser = argparse.ArgumentParser(
        description="Load Hotels listings from CSV into PostGIS (public.hotels_listings)"
    )
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument(
        "--semel", type=int, default=2600, help="SEMEL_YISH (default: 2600 for Eilat)"
    )
    parser.add_argument(
        "--batch", type=int, default=100, help="Batch size for inserts (default: 100)"
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="CSV encoding (default: utf-8). Try 'utf-8-sig' if you see weird chars.",
    )
    args = parser.parse_args()

    # 1) Resolve CSV file path
    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        if not csv_path.exists():
            script_dir = Path(__file__).parent
            project_root = script_dir.parent.parent
            potential_path = project_root / csv_path
            if potential_path.exists():
                csv_path = potential_path
            else:
                raise RuntimeError(
                    f"CSV file not found: {args.csv}\n"
                    f"Tried: {Path(args.csv).absolute()}\n"
                    f"Tried: {project_root / args.csv}"
                )
    else:
        if not csv_path.exists():
            raise RuntimeError(f"CSV file not found: {csv_path}")

    # 2) Load CSV file
    print(f"Loading CSV file: {csv_path}")
    try:
        df = pd.read_csv(csv_path, encoding=args.encoding)
    except Exception as e:
        raise RuntimeError(f"Failed to read CSV file: {e}")

    if df.empty:
        raise RuntimeError("CSV file is empty")

    print(f"Loaded {len(df)} rows from CSV")
    print(f"Columns found: {list(df.columns)}")

    # 2.1) Strict CSV schema validation (optional but recommended)
    expected_columns = [
        "hotelId",
        "name",
        "type",
        "description",
        "url",
        "rating",
        "address/full",
        "location/lat",
        "location/lng",
        "stat_2022",
    ]

    missing = [c for c in expected_columns if c not in df.columns]
    extra = [c for c in df.columns if c not in expected_columns]

    if missing:
        raise RuntimeError(
            f"CSV schema mismatch.\n"
            f"Missing columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    if extra:
        print(f"⚠️ Warning: extra columns in CSV will be ignored: {extra}")


    # 3) Map columns (based on your CSV spec)
    hotelid_col = _find_column(df, ["hotelid", "hotelId"])
    name_col = _find_column(df, ["name"])
    type_col = _find_column(df, ["type"])
    description_col = _find_column(df, ["description"])
    url_col = _find_column(df, ["url"])
    rating_col = _find_column(df, ["rating"])

    full_address_col = _find_column(df, ["address/full", "fulladdress", "address"])
    lat_col = _find_column(df, ["location/lat", "lat", "latitude"])
    lon_col = _find_column(df, ["location/lng", "lng", "lon", "longitude"])
    stat_2022_col = _find_column(df, ["stat_2022"])

    # Validate required columns (based on table NOT NULLs + your csv)
    if not hotelid_col:
        raise RuntimeError(
            "Required column 'hotelId' not found. "
            f"Found columns: {list(df.columns)}"
        )
    if not name_col:
        raise RuntimeError(
            "Required column 'name' not found. " f"Found columns: {list(df.columns)}"
        )
    if not lat_col:
        raise RuntimeError(
            "Required column 'location/lat' not found. "
            f"Found columns: {list(df.columns)}"
        )
    if not lon_col:
        raise RuntimeError(
            "Required column 'location/lng' not found. "
            f"Found columns: {list(df.columns)}"
        )
    if not stat_2022_col:
        raise RuntimeError(
            "Required column 'stat_2022' not found. "
            f"Found columns: {list(df.columns)}"
        )

    # 4) Prepare rows
    rows = []
    skipped = []

    for idx, row in df.iterrows():
        # Required fields
        hotelid_val = _to_jsonable(row[hotelid_col])
        name_val = _to_jsonable(row[name_col])
        lat_val = _to_jsonable(row[lat_col])
        lon_val = _to_jsonable(row[lon_col])
        stat_2022_val = _to_jsonable(row[stat_2022_col])

        # Validate required
        if hotelid_val is None:
            skipped.append((idx + 2, "missing hotelId"))
            continue
        if not name_val:
            skipped.append((idx + 2, "missing name"))
            continue

        # hotelid -> int
        try:
            hotelid_int = int(float(hotelid_val))
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid hotelId: {hotelid_val}"))
            continue

        # lat/lon -> float
        try:
            lat_float = float(lat_val) if lat_val is not None else None
            lon_float = float(lon_val) if lon_val is not None else None
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid lat/lon: {lat_val}/{lon_val}"))
            continue

        if lat_float is None or lon_float is None:
            skipped.append((idx + 2, "missing lat/lon"))
            continue

        if not (-90 <= lat_float <= 90):
            skipped.append((idx + 2, f"invalid latitude: {lat_float}"))
            continue
        if not (-180 <= lon_float <= 180):
            skipped.append((idx + 2, f"invalid longitude: {lon_float}"))
            continue

        # stat_2022 -> int
        try:
            stat_2022_int = int(float(stat_2022_val)) if stat_2022_val is not None else None
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid stat_2022: {stat_2022_val}"))
            continue

        if stat_2022_int is None:
            skipped.append((idx + 2, "missing stat_2022"))
            continue

        # Geometry
        point = Point(lon_float, lat_float)
        location_wkt = point.wkt

        # Optional fields
        url = _to_jsonable(row[url_col]) if url_col else None
        description = _to_jsonable(row[description_col]) if description_col else None
        hotel_type = _to_jsonable(row[type_col]) if type_col else None
        full_address = _to_jsonable(row[full_address_col]) if full_address_col else None

        rating_value = None
        if rating_col:
            rating_val = _to_jsonable(row[rating_col])
            if rating_val is not None:
                try:
                    rating_value = float(rating_val)
                except (ValueError, TypeError):
                    rating_value = None

        rows.append(
            (
                hotelid_int,
                url,
                str(name_val),
                description,
                hotel_type,
                rating_value,
                full_address,
                location_wkt,
                lat_float,
                lon_float,
                args.semel,
                stat_2022_int,
            )
        )

    if skipped:
        print(f"\nWarning: Skipped {len(skipped)} rows:")
        for row_num, reason in skipped[:10]:
            print(f"  Row {row_num}: {reason}")
        if len(skipped) > 10:
            print(f"  ... and {len(skipped) - 10} more")

    if not rows:
        raise RuntimeError("No valid rows to insert")

    # 5) DB upsert
    await init_db_pool()
    pool = get_pool()

    sql = """
    INSERT INTO public.hotels_listings
      (hotelid, url, name, description, type,
       rating_value,
       location_fulladdress,
       location, coordinates_latitude, coordinates_longitude,
       semel_yish, stat_2022)
    VALUES
      ($1, $2, $3, $4, $5,
       $6,
       $7,
       ST_SetSRID(ST_GeomFromText($8), 4326), $9, $10,
       $11, $12)
    ON CONFLICT (hotelid)
    DO UPDATE SET
      url = excluded.url,
      name = excluded.name,
      description = excluded.description,
      type = excluded.type,
      rating_value = excluded.rating_value,
      location_fulladdress = excluded.location_fulladdress,
      location = excluded.location,
      coordinates_latitude = excluded.coordinates_latitude,
      coordinates_longitude = excluded.coordinates_longitude,
      semel_yish = excluded.semel_yish,
      stat_2022 = excluded.stat_2022,
      imported_at = now();
    """

    upserted = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i in range(0, len(rows), args.batch):
                batch_rows = rows[i : i + args.batch]
                await conn.executemany(sql, batch_rows)
                upserted += len(batch_rows)
                print(f"Upserted {upserted}/{len(rows)} rows...")

    await close_db_pool()
    print(f"\nDone. Upserted total: {upserted} hotels listings from {csv_path}")


if __name__ == "__main__":
    asyncio.run(main())
