"""OSM Facilities API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/osm-facilities", tags=["osm-facilities"])


@router.get("/types")
async def get_facility_types():
    """
    Get list of all available facility types in the database.
    Useful for populating filter dropdowns.
    """
    pool = get_pool()

    query = """
        SELECT DISTINCT facility_type
        FROM osm_city_facilities
        WHERE semel_yish = 2600
        ORDER BY facility_type
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
            types = [row["facility_type"] for row in rows]
            return {"types": types}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("")
async def get_osm_facilities(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    facility_types: Optional[str] = Query(
        None,
        description="Comma-separated list of facility types to include (e.g., 'school,park,pharmacy')",
    ),
):
    """
    Get OSM facilities as GeoJSON FeatureCollection.
    Supports filtering by area and facility types.
    If facility_types is not provided, returns all facilities.
    """
    pool = get_pool()

    conditions = ["of.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"of.stat_2022 = ${param_count}")
        params.append(area)

    if facility_types:
        # Parse comma-separated facility types
        types_list = [t.strip() for t in facility_types.split(",") if t.strip()]
        if types_list:
            param_count += 1
            # Use ANY with array for PostgreSQL
            conditions.append(f"of.facility_type = ANY(${param_count}::text[])")
            params.append(types_list)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            of.uuid::text,
            of.name,
            of.facility_type,
            of.stat_2022,
            ST_AsGeoJSON(of.location)::jsonb as geometry
        FROM osm_city_facilities of
        WHERE {where_clause}
        ORDER BY of.facility_type, of.name NULLS LAST
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "uuid": row["uuid"],
                    "name": row["name"],
                    "facility_type": row["facility_type"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
