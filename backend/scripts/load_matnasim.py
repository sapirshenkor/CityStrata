"""
Script to load community centers (Matnasim) from a CSV file into Supabase/PostGIS.
Includes safe type conversion and spatial data handling.
"""

import argparse
import asyncio
from pathlib import Path
from typing import Any, Optional

import numpy as np
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
    This prevents 'TypeError: str object cannot be interpreted as integer' in asyncpg.
    """
    if pd.isna(v) or v is None or str(v).strip() == "":
        return None
    try:
        # Converting to float first handles cases like '2000.0' in the CSV
        return int(float(v))
    except (ValueError, TypeError):
        return None


async def main():
    # Setup command line arguments
    parser = argparse.ArgumentParser(
        description="Load Matnasim data from CSV into Supabase"
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
        name = _to_jsonable(row.get('matnas_name'))
        lat_val = row.get('location_lat')
        lng_val = row.get('location_lng')
        stat_val = row.get('stat_2022')
        semel_val = row.get('semel_yish')

        # Basic validation
        if not name:
            skipped.append((idx + 2, "Missing matnas_name"))
            continue

        try:
            # Explicit numeric conversion
            lat_f = float(lat_val) if lat_val else None
            lng_f = float(lng_val) if lng_val else None
            stat_i = _to_int(stat_val)
            semel_i = _to_int(semel_val) or 2600  # Default to Eilat code
            
            # Convert area and occupancy to integers (Fixes previous error)
            f_area = _to_int(row.get('Facility_area'))
            occ = _to_int(row.get('occupancy'))
            
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
        rows.append((
            name,                                  # $1
            _to_jsonable(row.get('full_address')), # $2
            _to_jsonable(row.get('person_in_charge')), # $3
            _to_jsonable(row.get('phone_number')), # $4
            _to_jsonable(row.get('activity_days')), # $5
            f_area,                                # $6 (Integer)
            occ,                                   # $7 (Integer)
            _to_jsonable(row.get('number_of_activity_rooms')), # $8
            _to_jsonable(row.get('shelter_and_where')), # $9
            lat_f,                                 # $10
            lng_f,                                 # $11
            location_wkt,                          # $12
            semel_i,                               # $13
            stat_i                                 # $14
        ))

    if skipped:
        print(f"Notice: Skipped {len(skipped)} rows due to validation issues.")
        for r_num, reason in skipped[:3]:
            print(f"  - Row {r_num}: {reason}")

    # 4) Initialize Database and Execute Upsert
    await init_db_pool()
    pool = get_pool()

    # SQL Insert with ON CONFLICT for automatic updates
    sql = """
    INSERT INTO public.matnasim (
        matnas_name, 
        full_address, 
        person_in_charge, 
        phone_number,
        activity_days, 
        facility_area, 
        occupancy, 
        number_of_activity_rooms,
        shelter_and_where, 
        location_lat, 
        location_lng, 
        location,
        semel_yish, 
        stat_2022
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        ST_SetSRID(ST_GeomFromText($12), 4326), $13, $14
    )
    ON CONFLICT (matnas_name)
    DO UPDATE SET
        full_address = EXCLUDED.full_address,
        person_in_charge = EXCLUDED.person_in_charge,
        phone_number = EXCLUDED.phone_number,
        activity_days = EXCLUDED.activity_days,
        facility_area = EXCLUDED.facility_area,
        occupancy = EXCLUDED.occupancy,
        number_of_activity_rooms = EXCLUDED.number_of_activity_rooms,
        shelter_and_where = EXCLUDED.shelter_and_where,
        location_lat = EXCLUDED.location_lat,
        location_lng = EXCLUDED.location_lng,
        location = EXCLUDED.location,
        semel_yish = EXCLUDED.semel_yish,
        stat_2022 = EXCLUDED.stat_2022,
        imported_at = NOW();
    """

    inserted_count = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Process in batches for better performance
            for i in range(0, len(rows), args.batch):
                batch = rows[i : i + args.batch]
                await conn.executemany(sql, batch)
                inserted_count += len(batch)
                print(f"Uploaded {inserted_count}/{len(rows)} entries...")

    await close_db_pool()
    print(f"\nCOMPLETED: {inserted_count} community centers are now in Supabase.")


if __name__ == "__main__":
    asyncio.run(main())