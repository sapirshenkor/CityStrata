"""Matnasim API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/matnasim", tags=["matnasim"])


@router.get("")
async def get_matnasim(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    min_facility_area: Optional[int] = Query(None, description="Minimum facility area"),
    min_occupancy: Optional[int] = Query(None, description="Minimum occupancy"),
):
    """
    Get matnasim (community centers) as GeoJSON FeatureCollection.
    Supports filtering by area, facility area, and occupancy.
    """
    pool = get_pool()

    conditions = ["m.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"m.stat_2022 = ${param_count}")
        params.append(area)

    if min_facility_area is not None:
        param_count += 1
        conditions.append(f"m.facility_area >= ${param_count}")
        params.append(min_facility_area)

    if min_occupancy is not None:
        param_count += 1
        conditions.append(f"m.occupancy >= ${param_count}")
        params.append(min_occupancy)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            m.uuid::text,
            m.matnas_name,
            m.full_address,
            m.person_in_charge,
            m.phone_number,
            m.activity_days,
            m.facility_area,
            m.occupancy,
            m.number_of_activity_rooms,
            m.stat_2022,
            ST_AsGeoJSON(m.location)::jsonb as geometry
        FROM matnasim m
        WHERE {where_clause}
        ORDER BY m.matnas_name
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "uuid": row["uuid"],
                    "matnas_name": row["matnas_name"],
                    "full_address": row["full_address"],
                    "person_in_charge": row["person_in_charge"],
                    "phone_number": row["phone_number"],
                    "activity_days": row["activity_days"],
                    "facility_area": row["facility_area"],
                    "occupancy": row["occupancy"],
                    "number_of_activity_rooms": row["number_of_activity_rooms"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
