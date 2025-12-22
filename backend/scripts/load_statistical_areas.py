"""
 """

import argparse
import asyncio
import json
from typing import Any

import geopandas as gpd
import numpy as np
from shapely.geometry import MultiPolygon, Polygon

from app.core.database import init_db_pool, get_pool, close_db_pool


def _to_jsonable(v: Any) -> Any:
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    # GeoPandas sometimes stores Timestamp-like objects; stringify as fallback
    try:
        json.dumps(v)
        return v
    except TypeError:
        return str(v)


def _ensure_multipolygon(geom):
    """Normalize Polygon -> MultiPolygon."""
    if geom is None:
        return None
    if isinstance(geom, MultiPolygon):
        return geom
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    # In case of other geometry types, keep as-is (but DB expects MultiPolygon)
    return geom


async def main():
    parser = argparse.ArgumentParser(description="Load CBS statistical areas (SHP) into PostGIS")
    parser.add_argument("--shp", required=True, help="Path to statistical_areas_2022.shp")
    parser.add_argument("--semel", type=int, default=2600, help="SEMEL_YISH (default: 2600 for Eilat)")
    parser.add_argument("--srid_out", type=int, default=4326, help="Output SRID stored in DB (default: 4326)")
    parser.add_argument("--srid_area", type=int, default=2039, help="SRID used for area/centroid calc (default: 2039)")
    parser.add_argument("--batch", type=int, default=200, help="Batch size for inserts")
    args = parser.parse_args()

    # 1) Load SHP
    gdf = gpd.read_file(args.shp)

    # 2) Filter Eilat (or provided SEMEL)
    if "SEMEL_YISH" not in gdf.columns:
        raise RuntimeError("Column 'SEMEL_YISH' not found in SHP.")
    gdf = gdf[gdf["SEMEL_YISH"] == args.semel].copy()

    if gdf.empty:
        raise RuntimeError(f"No rows found for SEMEL_YISH={args.semel}")

    # 3) Validate STAT_2022 exists
    if "STAT_2022" not in gdf.columns:
        raise RuntimeError("Column 'STAT_2022' not found in SHP. Please confirm the column name.")
    # Normalize type
    gdf["STAT_2022"] = gdf["STAT_2022"].astype(int)

    # 4) Compute area_m2 + centroid using a metric CRS (ITM 2039 by default)
    gdf_metric = gdf.to_crs(epsg=args.srid_area)
    gdf["area_m2"] = gdf_metric.geometry.area

    # centroid in metric CRS then convert to 4326
    cent_metric = gdf_metric.geometry.centroid
    cent_wgs = gpd.GeoSeries(cent_metric, crs=f"EPSG:{args.srid_area}").to_crs(epsg=args.srid_out)
    gdf["centroid_geom"] = cent_wgs

    # 5) Convert main geometry to output SRID (4326)
    gdf = gdf.to_crs(epsg=args.srid_out)

    # 6) Prepare rows
    # All properties except geometry
    geom_col = gdf.geometry.name
    props_cols = [c for c in gdf.columns if c not in {geom_col, "area_m2", "centroid_geom"}]

    rows = []
    for _, row in gdf.iterrows():
        geom = _ensure_multipolygon(row[geom_col])
        if geom is None:
            continue

        centroid = row["centroid_geom"]
        centroid_wkt = centroid.wkt if centroid is not None else None

        props = {c: _to_jsonable(row[c]) for c in props_cols}
        # Keep only json-able props
        props = json.loads(json.dumps(props, default=str))

        rows.append(
            (
                int(row["SEMEL_YISH"]),
                int(row["STAT_2022"]),
                geom.wkt,                 # polygon/multipolygon WKT
                float(row["area_m2"]) if row["area_m2"] is not None else None,
                centroid_wkt,             # point WKT
                json.dumps(props),        # json string -> jsonb
            )
        )

    # 7) DB upsert
    await init_db_pool()
    pool = get_pool()

    sql = """
    insert into public.statistical_areas
      (semel_yish, stat_2022, geom, area_m2, centroid, properties)
    values
      ($1, $2,
       ST_SetSRID(ST_GeomFromText($3), 4326),
       $4,
       CASE WHEN $5::text is null THEN null
       ELSE ST_SetSRID(ST_GeomFromText($5::text), 4326) END,
       $6::jsonb
      )
    on conflict (semel_yish, stat_2022)
    do update set
      geom = excluded.geom,
      area_m2 = excluded.area_m2,
      centroid = excluded.centroid,
      properties = excluded.properties,
      imported_at = now();
    """

    inserted = 0
    async with pool.acquire() as conn:
        # optional: speed up large loads
        async with conn.transaction():
            for i in range(0, len(rows), args.batch):
                batch_rows = rows[i : i + args.batch]
                await conn.executemany(sql, batch_rows)
                inserted += len(batch_rows)
                print(f"Upserted {inserted}/{len(rows)} rows...")

    await close_db_pool()
    print(f"Done. Upserted total: {inserted} statistical areas for SEMEL_YISH={args.semel}")


if __name__ == "__main__":
    asyncio.run(main())
