"""Educational Institutions API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("")
async def get_institutions(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    phase: Optional[str] = Query(None, description="Filter by education phase"),
    type: Optional[str] = Query(None, description="Filter by type of education"),
):
    """
    Get educational institutions as GeoJSON FeatureCollection.
    Supports filtering by area, phase, and type.
    """
    pool = get_pool()

    conditions = ["ei.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"ei.stat_2022 = ${param_count}")
        params.append(area)

    if phase is not None:
        param_count += 1
        conditions.append(f"ei.education_phase = ${param_count}")
        params.append(phase)

    if type is not None:
        param_count += 1
        conditions.append(f"ei.type_of_education = ${param_count}")
        params.append(type)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            ei.id::text,
            ei.institution_code,
            ei.institution_name,
            ei.address,
            ei.full_address,
            ei.type_of_supervision,
            ei.type_of_education,
            ei.education_phase,
            ei.lat,
            ei.lon,
            ei.stat_2022,
            ST_AsGeoJSON(ei.location)::jsonb as geometry
        FROM educational_institutions ei
        WHERE {where_clause}
        ORDER BY ei.institution_name
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "id": row["id"],
                    "institution_code": row["institution_code"],
                    "institution_name": row["institution_name"],
                    "address": row["address"],
                    "full_address": row["full_address"],
                    "type_of_supervision": row["type_of_supervision"],
                    "type_of_education": row["type_of_education"],
                    "education_phase": row["education_phase"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{institution_code}")
async def get_institution(institution_code: str):
    """
    Get specific educational institution by code.
    """
    pool = get_pool()

    query = """
        SELECT 
            ei.id::text,
            ei.institution_code,
            ei.institution_name,
            ei.address,
            ei.full_address,
            ei.type_of_supervision,
            ei.type_of_education,
            ei.education_phase,
            ei.lat,
            ei.lon,
            ei.stat_2022,
            ei.imported_at,
            ST_AsGeoJSON(ei.location)::jsonb as geometry
        FROM educational_institutions ei
        WHERE ei.institution_code = $1
    """

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, institution_code)

            if not row:
                raise HTTPException(
                    status_code=404, detail=f"Institution {institution_code} not found"
                )

            geometry = parse_postgis_geojson(row["geometry"])
            properties = {
                "id": row["id"],
                "institution_code": row["institution_code"],
                "institution_name": row["institution_name"],
                "address": row["address"],
                "full_address": row["full_address"],
                "type_of_supervision": row["type_of_supervision"],
                "type_of_education": row["type_of_education"],
                "education_phase": row["education_phase"],
                "stat_2022": row["stat_2022"],
                "imported_at": (
                    row["imported_at"].isoformat() if row["imported_at"] else None
                ),
            }

            return {"type": "Feature", "geometry": geometry, "properties": properties}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
