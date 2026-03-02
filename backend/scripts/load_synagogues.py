"""
Script to load Synagogues from a CSV file into Supabase/PostGIS.
Includes safe type conversion and spatial data handling.
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
    """
    Cleans data for database insertion. 
    Converts pandas/numpy NaN to None and strips whitespace from strings.
    """
    if pd.isna(v) or v is None:
        return None
    try:
        result = str(v).strip()
        return result if result else None
    except Exception:
        return None


def _to_int(v: Any) -> Optional[int]:
    """
    Safely converts CSV string/float values to integers.
    """
    if pd.isna(v) or v is None or str(v).strip() == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


async def main():
    # Setup command line arguments
    parser = argparse.ArgumentParser(
        description="Load Synagogues data from CSV into Supabase"
    )
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    parser.add_argument(
        "--batch", type=int, default=100, help="Number of rows per database transaction"
    )
    args = parser.parse_args()

    # 1) Verify CSV file existence
    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise RuntimeError(f"CSV file not found at: {csv_path}")

    # 2) Load CSV using pandas
    print(f"Reading CSV file: {csv_path}")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        raise RuntimeError(f"Failed to read CSV: {e}")

    if df.empty:
        raise RuntimeError("The provided CSV file is empty.")

    print(f"Successfully loaded {len(df)} rows. Processing data...")

    # 3) Process rows and prepare for SQL insertion
    rows = []
    skipped = []

    for idx, row in df.iterrows():
        # Extract mandatory identification and location fields
        name = _to_jsonable(row.get('name'))
        lat_val = row.get('lat')
        lng_val = row.get('lon')
        stat_val = row.get('stat_2022')

        # Basic validation
        if not name:
            skipped.append((idx + 2, "Missing name"))
            continue

        try:
            # Explicit numeric conversion
            lat_f = float(lat_val) if lat_val else None
            lng_f = float(lng_val) if lng_val else None
            stat_i = _to_int(stat_val)
            semel_i = 2600  # Default to Eilat code
            
        except (ValueError, TypeError) as e:
            skipped.append((idx + 2, f"Value conversion error: {e}"))
            continue

        # Ensure we have coordinates and a statistical area before proceeding
        if lat_f is None or lng_f is None or stat_i is None:
            skipped.append((idx + 2, "Missing coordinates or stat_2022 code"))
            continue

        # Create PostGIS compatible geometry (Well-Known Text format)
        location_wkt = Point(lng_f, lat_f).wkt

        # Add data to the list in the EXACT order defined in the SQL query
        # Note: CSV has "adress" but table column is "address"
        rows.append((
            name,                                      # $1
            _to_jsonable(row.get('name_he')),         # $2
            _to_jsonable(row.get('type')),            # $3
            _to_jsonable(row.get('type_he')),         # $4
            _to_jsonable(row.get('adress')),          # $5 (note: CSV typo "adress")
            lat_f,                                     # $6
            lng_f,                                     # $7
            location_wkt,                              # $8
            semel_i,                                   # $9
            stat_i                                     # $10
        ))

    if skipped:
        print(f"Notice: Skipped {len(skipped)} rows due to validation issues.")
        for r_num, reason in skipped[:5]:
            print(f"  - Row {r_num}: {reason}")

    # 4) Initialize Database and Execute Insert
    await init_db_pool()
    pool = get_pool()

    # SQL Insert - simple insert (if you need conflict handling, add unique constraint first)
    sql = """
    INSERT INTO public.synagogues (
        name, 
        name_he, 
        type, 
        type_he,
        address, 
        location_lat, 
        location_lng, 
        location,
        semel_yish, 
        stat_2022
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        ST_SetSRID(ST_GeomFromText($8), 4326), $9, $10
    );
    """

    inserted_count = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Process in batches for better performance
            for i in range(0, len(rows), args.batch):
                batch = rows[i : i + args.batch]
                await conn.executemany(sql, batch)
                inserted_count += len(batch)
                print(f"Uploaded {inserted_count}/{len(rows)} synagogues...")

    await close_db_pool()
    print(f"\nCOMPLETED: {inserted_count} synagogues successfully loaded to Supabase.")


if __name__ == "__main__":
    asyncio.run(main())
