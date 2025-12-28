"""
Script to load OSM City Facilities from a CSV file into Supabase/PostGIS.
Matches the schema: public.osm_city_facilities
"""

import argparse
import asyncio
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from shapely.geometry import Point

# Importing database utility functions from your project structure
from app.core.database import init_db_pool, get_pool, close_db_pool


def _to_jsonable(v: Any) -> Any:
    """Cleans data: handles NaNs and strips strings."""
    if pd.isna(v) or v is None:
        return None
    try:
        result = str(v).strip()
        return result if result else None
    except Exception:
        return None


def _to_int(v: Any) -> Optional[int]:
    """Safely converts values to integers."""
    if pd.isna(v) or v is None or str(v).strip() == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


async def main():
    parser = argparse.ArgumentParser(
        description="Load OSM Facility data from CSV into Supabase"
    )
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    parser.add_argument(
        "--batch", type=int, default=200, help="Number of rows per transaction"
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise RuntimeError(f"CSV file not found at: {csv_path}")

    print(f"Reading CSV file: {csv_path}")
    df = pd.read_csv(csv_path)

    if df.empty:
        print("The provided CSV file is empty. Exiting.")
        return

    print(f"Processing {len(df)} facilities...")

    rows = []
    skipped = 0

    for idx, row in df.iterrows():
        # 1. Extract and Clean Data
        name = _to_jsonable(row.get('name'))
        f_type = _to_jsonable(row.get('facility_type'))
        lat_val = row.get('location_lat')
        lng_val = row.get('location_lng')
        stat_val = row.get('stat_2022')
        semel_val = row.get('semel_yish')

        # 2. Validation
        if not f_type or pd.isna(lat_val) or pd.isna(lng_val) or pd.isna(stat_val):
            skipped += 1
            continue

        try:
            lat_f = float(lat_val)
            lng_f = float(lng_val)
            stat_i = _to_int(stat_val)
            semel_i = _to_int(semel_val) or 2600
            
            # Create WKT Geometry for PostGIS
            location_wkt = Point(lng_f, lat_f).wkt

            # 3. Add to Batch (Matching the $ order in the SQL below)
            rows.append((
                name,          # $1
                f_type,        # $2
                lat_f,         # $3
                lng_f,         # $4
                location_wkt,  # $5
                semel_i,       # $6
                stat_i         # $7
            ))
        except Exception:
            skipped += 1
            continue

    if skipped:
        print(f"Notice: Skipped {skipped} rows due to missing data or errors.")

    # 4. Database Connection and Execution
    await init_db_pool()
    pool = get_pool()

    sql = """
    INSERT INTO public.osm_city_facilities (
        name, 
        facility_type, 
        location_lat, 
        location_lng, 
        location,
        semel_yish, 
        stat_2022
    ) VALUES (
        $1, $2, $3, $4, 
        ST_SetSRID(ST_GeomFromText($5), 4326), 
        $6, $7
    )
    ON CONFLICT (name, facility_type, location_lat, location_lng)
    DO UPDATE SET
        semel_yish = EXCLUDED.semel_yish,
        stat_2022 = EXCLUDED.stat_2022,
        imported_at = NOW();
    """

    inserted_count = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i in range(0, len(rows), args.batch):
                batch = rows[i : i + args.batch]
                await conn.executemany(sql, batch)
                inserted_count += len(batch)
                print(f"Uploaded {inserted_count}/{len(rows)} facilities...")

    await close_db_pool()
    print(f"\nCOMPLETED: {inserted_count} OSM facilities successfully loaded to Supabase.")


if __name__ == "__main__":
    asyncio.run(main())