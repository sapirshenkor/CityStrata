"""Load Airbnb listings from Excel file into PostGIS"""

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
    # Convert to string and strip whitespace
    try:
        result = str(v).strip()
        return result if result else None
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
        description="Load Airbnb listings from Excel into PostGIS"
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
        "--semel",
        type=int,
        default=2600,
        help="SEMEL_YISH (default: 2600 for Eilat)",
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
    print(f"Columns found: {list(df.columns)}")

    # 3) Map columns - using exact column names from Excel
    id_col = _find_column(df, ["id"])
    url_col = _find_column(df, ["url"])
    title_col = _find_column(df, ["title"])
    description_col = _find_column(df, ["description"])

    # Price columns
    price_qualifier_col = _find_column(df, ["price/qualifier"])
    price_num_col = _find_column(df, ["price_numeric"])
    price_per_night_col = _find_column(df, ["price_per_night"])

    # Rating and capacity
    rating_value_col = _find_column(df, ["rating/value"])
    person_capacity_col = _find_column(df, ["personCapacity"])

    # Location columns
    location_subtitle_col = _find_column(df, ["locationSubtitle"])
    lat_col = _find_column(df, ["coordinates/latitude"])
    lon_col = _find_column(df, ["coordinates/longitude"])

    # Statistical area and nights
    stat_2022_col = _find_column(df, ["stat_2022"])
    num_nights_col = _find_column(df, ["num_nights"])

    # Validate required columns
    if not id_col:
        raise RuntimeError(
            "Required column 'id' not found. " f"Found columns: {list(df.columns)}"
        )
    if not title_col:
        raise RuntimeError(
            "Required column 'title' not found. " f"Found columns: {list(df.columns)}"
        )
    if not lat_col:
        raise RuntimeError(
            "Required column 'coordinates/latitude' not found. "
            f"Found columns: {list(df.columns)}"
        )
    if not lon_col:
        raise RuntimeError(
            "Required column 'coordinates/longitude' not found. "
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
        # Extract required fields
        listing_id = _to_jsonable(row[id_col])
        title_val = _to_jsonable(row[title_col])
        lat_val = _to_jsonable(row[lat_col])
        lon_val = _to_jsonable(row[lon_col])
        stat_2022_val = _to_jsonable(row[stat_2022_col])

        # Validate required fields
        if listing_id is None:
            skipped.append((idx + 2, "missing id"))
            continue
        if not title_val:
            skipped.append((idx + 2, "missing title"))
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

        # Validate and convert id
        try:
            listing_id_int = int(listing_id)
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid id: {listing_id}"))
            continue

        # Create Point geometry
        point = Point(lon_float, lat_float)
        location_wkt = point.wkt

        # Extract optional fields
        url = _to_jsonable(row[url_col]) if url_col else None
        description = _to_jsonable(row[description_col]) if description_col else None

        # Price fields
        price_qualifier = (
            _to_jsonable(row[price_qualifier_col]) if price_qualifier_col else None
        )

        # Get price_numeric
        price_numeric = None
        if price_num_col:
            price_numeric_val = _to_jsonable(row[price_num_col])
            if price_numeric_val is not None:
                try:
                    price_numeric = int(float(price_numeric_val))
                except (ValueError, TypeError):
                    price_numeric = None

        num_nights = None
        if num_nights_col:
            num_nights_val = _to_jsonable(row[num_nights_col])
            if num_nights_val is not None:
                try:
                    num_nights = int(float(num_nights_val))
                except (ValueError, TypeError):
                    num_nights = None

        price_per_night = None
        if price_per_night_col:
            price_per_night_val = _to_jsonable(row[price_per_night_col])
            if price_per_night_val is not None:
                try:
                    price_per_night = float(price_per_night_val)
                except (ValueError, TypeError):
                    price_per_night = None

        # Rating and capacity
        rating_value = None
        if rating_value_col:
            rating_val = _to_jsonable(row[rating_value_col])
            if rating_val is not None:
                try:
                    rating_value = float(rating_val)
                except (ValueError, TypeError):
                    rating_value = None

        person_capacity = None
        if person_capacity_col:
            capacity_val = _to_jsonable(row[person_capacity_col])
            if capacity_val is not None:
                try:
                    person_capacity = int(float(capacity_val))
                except (ValueError, TypeError):
                    person_capacity = None

        location_subtitle = (
            _to_jsonable(row[location_subtitle_col]) if location_subtitle_col else None
        )

        rows.append(
            (
                listing_id_int,
                url,
                str(title_val),
                description,
                price_qualifier,
                price_numeric,
                num_nights,
                price_per_night,
                rating_value,
                person_capacity,
                location_subtitle,
                location_wkt,
                lat_float,
                lon_float,
                args.semel,
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
    INSERT INTO public.airbnb_listings
      (id, url, title, description,
       price_qualifier, price_numeric, num_nights, price_per_night,
       rating_value, person_capacity, location_subtitle,
       location, coordinates_latitude, coordinates_longitude,
       semel_yish, stat_2022)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       ST_SetSRID(ST_GeomFromText($12), 4326), $13, $14, $15, $16)
    ON CONFLICT (id)
    DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      description = excluded.description,
      price_qualifier = excluded.price_qualifier,
      price_numeric = excluded.price_numeric,
      num_nights = excluded.num_nights,
      price_per_night = excluded.price_per_night,
      rating_value = excluded.rating_value,
      person_capacity = excluded.person_capacity,
      location_subtitle = excluded.location_subtitle,
      location = excluded.location,
      coordinates_latitude = excluded.coordinates_latitude,
      coordinates_longitude = excluded.coordinates_longitude,
      semel_yish = excluded.semel_yish,
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
    print(f"\nDone. Upserted total: {inserted} Airbnb listings from {excel_path}")


if __name__ == "__main__":
    asyncio.run(main())
