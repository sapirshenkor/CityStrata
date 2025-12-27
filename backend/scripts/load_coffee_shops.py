"""Load coffee shops from CSV file into PostGIS"""

import argparse
import asyncio
import json
import ast
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


def _parse_activity_times(activity_times_str: Optional[str]) -> Optional[dict]:
    """Parse activity times from string representation to JSON."""
    if (
        not activity_times_str
        or activity_times_str == "{}"
        or pd.isna(activity_times_str)
    ):
        return None

    try:
        # Try to parse as Python dict literal (using ast.literal_eval)
        # The CSV contains strings like "{'opening_hours': {'mon': ['08:00-16:30'], ...}}"
        parsed = ast.literal_eval(activity_times_str)
        if isinstance(parsed, dict):
            # Convert to JSON-serializable format
            return json.loads(json.dumps(parsed))
    except (ValueError, SyntaxError, TypeError):
        pass

    # Try to parse as JSON
    try:
        return json.loads(activity_times_str)
    except (json.JSONDecodeError, TypeError):
        pass

    return None


async def main():
    parser = argparse.ArgumentParser(
        description="Load coffee shops from CSV into PostGIS"
    )
    parser.add_argument("--csv", required=True, help="Path to CSV file")
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

    # 1) Resolve CSV file path
    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        # If relative path, try current dir first, then project root
        if not csv_path.exists():
            # Try relative to project root (parent of backend)
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
        df = pd.read_csv(csv_path)
    except Exception as e:
        raise RuntimeError(f"Failed to read CSV file: {e}")

    if df.empty:
        raise RuntimeError("CSV file is empty or has no data")

    print(f"Loaded {len(df)} rows from CSV")
    print(f"Columns found: {list(df.columns)}")

    # 3) Map columns - handle column name variations
    cid_col = None
    title_col = None
    description_col = None
    category_name_col = None
    total_score_col = None
    temporarily_closed_col = None
    permanently_closed_col = None
    url_col = None
    website_col = None
    street_col = None
    lat_col = None
    lng_col = None
    stat_2022_col = None
    activity_times_col = None

    # Find columns (case-insensitive, flexible matching)
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower == "cid":
            cid_col = col
        elif col_lower == "title":
            title_col = col
        elif col_lower == "description":
            description_col = col
        elif col_lower == "categoryname" or col_lower == "category_name":
            category_name_col = col
        elif col_lower == "totalscore" or col_lower == "total_score":
            total_score_col = col
        elif col_lower == "temporarilyclosed" or col_lower == "temporarily_closed":
            temporarily_closed_col = col
        elif col_lower == "permanentlyclosed" or col_lower == "permanently_closed":
            permanently_closed_col = col
        elif col_lower == "url":
            url_col = col
        elif col_lower == "website":
            website_col = col
        elif col_lower == "street":
            street_col = col
        elif "location" in col_lower and "lat" in col_lower:
            lat_col = col
        elif "location" in col_lower and ("lng" in col_lower or "long" in col_lower):
            lng_col = col
        elif col_lower == "stat_2022" or col_lower == "stat2022":
            stat_2022_col = col
        elif "activity" in col_lower and "time" in col_lower:
            activity_times_col = col

    # Validate required columns
    if not cid_col:
        raise RuntimeError(
            "Required column 'cid' not found. " f"Found columns: {list(df.columns)}"
        )
    if not title_col:
        raise RuntimeError(
            "Required column 'title' not found. " f"Found columns: {list(df.columns)}"
        )
    if not lat_col:
        raise RuntimeError(
            "Required column 'location/lat' (latitude) not found. "
            f"Found columns: {list(df.columns)}"
        )
    if not lng_col:
        raise RuntimeError(
            "Required column 'location/lng' (longitude) not found. "
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
        cid_val = _to_jsonable(row[cid_col])
        title_val = _to_jsonable(row[title_col])
        lat_val = _to_jsonable(row[lat_col])
        lng_val = _to_jsonable(row[lng_col])
        stat_2022_val = _to_jsonable(row[stat_2022_col])

        # Validate required fields
        if cid_val is None:
            skipped.append((idx + 2, "missing cid"))
            continue
        if not title_val:
            skipped.append((idx + 2, "missing title"))
            continue

        # Validate and convert lat/lng
        try:
            lat_float = float(lat_val) if lat_val is not None else None
            lng_float = float(lng_val) if lng_val is not None else None
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid lat/lng: {lat_val}/{lng_val}"))
            continue

        if lat_float is None or lng_float is None:
            skipped.append((idx + 2, "missing lat/lng"))
            continue

        # Validate lat/lng ranges
        if not (-90 <= lat_float <= 90):
            skipped.append((idx + 2, f"invalid latitude: {lat_float}"))
            continue
        if not (-180 <= lng_float <= 180):
            skipped.append((idx + 2, f"invalid longitude: {lng_float}"))
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

        # Validate and convert cid
        # Using NUMERIC type to handle large integer values
        try:
            cid_int = int(cid_val)
        except (ValueError, TypeError):
            skipped.append((idx + 2, f"invalid cid: {cid_val}"))
            continue

        # Create Point geometry
        point = Point(lng_float, lat_float)
        location_wkt = point.wkt

        # Extract optional fields
        description = _to_jsonable(row[description_col]) if description_col else None
        category_name = (
            _to_jsonable(row[category_name_col]) if category_name_col else None
        )

        # Handle total_score
        total_score = None
        if total_score_col:
            score_val = _to_jsonable(row[total_score_col])
            if score_val is not None:
                try:
                    total_score = float(score_val)
                except (ValueError, TypeError):
                    total_score = None

        # Handle boolean fields
        temporarily_closed = False
        if temporarily_closed_col:
            temp_val = _to_jsonable(row[temporarily_closed_col])
            if temp_val is not None:
                if isinstance(temp_val, bool):
                    temporarily_closed = temp_val
                elif isinstance(temp_val, str):
                    temporarily_closed = temp_val.lower() in ("true", "1", "yes")

        permanently_closed = False
        if permanently_closed_col:
            perm_val = _to_jsonable(row[permanently_closed_col])
            if perm_val is not None:
                if isinstance(perm_val, bool):
                    permanently_closed = perm_val
                elif isinstance(perm_val, str):
                    permanently_closed = perm_val.lower() in ("true", "1", "yes")

        url = _to_jsonable(row[url_col]) if url_col else None
        website = _to_jsonable(row[website_col]) if website_col else None
        street = _to_jsonable(row[street_col]) if street_col else None

        # Parse activity_times
        activity_times = None
        if activity_times_col:
            activity_times_str = _to_jsonable(row[activity_times_col])
            activity_times = _parse_activity_times(activity_times_str)

        # Convert activity_times to JSON string
        # Always pass a string (use 'null' when None) so PostgreSQL can infer the type
        if activity_times is not None:
            activity_times_json = json.dumps(activity_times)
        else:
            activity_times_json = "null"  # JSON null as string

        rows.append(
            (
                cid_int,
                str(title_val),
                description,
                category_name,
                total_score,
                temporarily_closed,
                permanently_closed,
                url,
                website,
                street,
                location_wkt,
                lat_float,
                lng_float,
                args.semel,
                stat_2022_int,
                activity_times_json,
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
    INSERT INTO public.coffee_shops
      (cid, title, description, category_name,
       total_score, temporarily_closed, permanently_closed,
       url, website, street,
       location, location_lat, location_lng,
       semel_yish, stat_2022, activity_times)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       ST_SetSRID(ST_GeomFromText($11), 4326), $12, $13, $14, $15,
       CASE WHEN $16 = 'null' THEN NULL ELSE ($16::text)::jsonb END)
    ON CONFLICT (cid)
    DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      category_name = excluded.category_name,
      total_score = excluded.total_score,
      temporarily_closed = excluded.temporarily_closed,
      permanently_closed = excluded.permanently_closed,
      url = excluded.url,
      website = excluded.website,
      street = excluded.street,
      location = excluded.location,
      location_lat = excluded.location_lat,
      location_lng = excluded.location_lng,
      semel_yish = excluded.semel_yish,
      stat_2022 = excluded.stat_2022,
      activity_times = excluded.activity_times,
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
    print(f"\nDone. Upserted total: {inserted} coffee shops from {csv_path}")


if __name__ == "__main__":
    asyncio.run(main())
