"""Synagogues API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/synagogues", tags=["synagogues"])


@router.get("")
async def get_synagogues(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    synagogue_type: Optional[str] = Query(None, description="Filter by synagogue type"),
):
    """
    Get synagogues as GeoJSON FeatureCollection.
    Supports filtering by area and type.
    """
    pool = get_pool()

    conditions = ["s.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"s.stat_2022 = ${param_count}")
        params.append(area)

    if synagogue_type is not None:
        param_count += 1
        conditions.append(f"s.type = ${param_count}")
        params.append(synagogue_type)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            s.uuid::text,
            s.name,
            s.name_he,
            s.type,
            s.type_he,
            s.address,
            s.stat_2022,
            ST_AsGeoJSON(s.location)::jsonb as geometry
        FROM synagogues s
        WHERE {where_clause}
        ORDER BY s.name
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
                    "name_he": row["name_he"],
                    "type": row["type"],
                    "type_he": row["type_he"],
                    "address": row["address"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
