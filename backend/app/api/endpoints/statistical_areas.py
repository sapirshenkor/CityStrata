"""Statistical Areas API endpoints"""

import json
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson
from app.models.statistical_area import StatisticalAreaSummary

router = APIRouter(prefix="/statistical-areas", tags=["statistical-areas"])


@router.get("")
async def get_all_statistical_areas():
    """
    Get all statistical areas as GeoJSON FeatureCollection.
    Returns all 25 statistical areas in Eilat.
    """
    pool = get_pool()

    query = """
        SELECT 
            id::text,
            stat_2022,
            area_m2,
            ST_AsGeoJSON(geom)::jsonb as geometry,
            COALESCE(properties, '{}'::jsonb) as properties,
            source
        FROM statistical_areas
        WHERE semel_yish = 2600
        ORDER BY stat_2022
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])

                # Handle properties - ensure it's a dict
                row_properties = row["properties"]
                if isinstance(row_properties, str):
                    row_properties = json.loads(row_properties)
                elif row_properties is None:
                    row_properties = {}

                properties = {
                    "id": row["id"],
                    "stat_2022": row["stat_2022"],
                    "area_m2": float(row["area_m2"]) if row["area_m2"] else None,
                    "source": row["source"],
                    **row_properties,
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{stat_2022}")
async def get_statistical_area(stat_2022: int):
    """
    Get specific statistical area with geometry.
    """
    pool = get_pool()

    query = """
        SELECT 
            id::text,
            stat_2022,
            area_m2,
            ST_AsGeoJSON(geom)::jsonb as geometry,
            COALESCE(properties, '{}'::jsonb) as properties,
            source,
            imported_at
        FROM statistical_areas
        WHERE semel_yish = 2600 AND stat_2022 = $1
    """

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, stat_2022)

            if not row:
                raise HTTPException(
                    status_code=404, detail=f"Statistical area {stat_2022} not found"
                )

            geometry = parse_postgis_geojson(row["geometry"])

            # Handle properties - ensure it's a dict
            row_properties = row["properties"]
            if isinstance(row_properties, str):
                import json

                row_properties = json.loads(row_properties)
            elif row_properties is None:
                row_properties = {}

            properties = {
                "id": row["id"],
                "stat_2022": row["stat_2022"],
                "area_m2": float(row["area_m2"]) if row["area_m2"] else None,
                "source": row["source"],
                "imported_at": (
                    row["imported_at"].isoformat() if row["imported_at"] else None
                ),
                **row_properties,
            }

            return {"type": "Feature", "geometry": geometry, "properties": properties}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{stat_2022}/summary")
async def get_statistical_area_summary(stat_2022: int):
    """
    Get detailed statistics for a statistical area.
    Includes counts of all resources in the area.
    """
    pool = get_pool()

    query = """
        SELECT 
            sa.stat_2022,
            sa.area_m2,
            COUNT(DISTINCT ei.id) as institutions_count,
            COUNT(DISTINCT al.uuid) as airbnb_count,
            COUNT(DISTINCT r.uuid) as restaurants_count,
            COUNT(DISTINCT cs.uuid) as coffee_shops_count,
            COALESCE(SUM(al.person_capacity), 0)::int as total_airbnb_capacity
        FROM statistical_areas sa
        LEFT JOIN educational_institutions ei ON 
            ei.semel_yish = sa.semel_yish AND ei.stat_2022 = sa.stat_2022
        LEFT JOIN airbnb_listings al ON 
            al.semel_yish = sa.semel_yish AND al.stat_2022 = sa.stat_2022
        LEFT JOIN restaurants r ON 
            r.semel_yish = sa.semel_yish AND r.stat_2022 = sa.stat_2022
        LEFT JOIN coffee_shops cs ON 
            cs.semel_yish = sa.semel_yish AND cs.stat_2022 = sa.stat_2022
        WHERE sa.semel_yish = 2600 AND sa.stat_2022 = $1
        GROUP BY sa.stat_2022, sa.area_m2
    """

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, stat_2022)

            if not row:
                raise HTTPException(
                    status_code=404, detail=f"Statistical area {stat_2022} not found"
                )

            return StatisticalAreaSummary(
                stat_2022=row["stat_2022"],
                area_m2=float(row["area_m2"]) if row["area_m2"] else 0.0,
                institutions_count=row["institutions_count"],
                airbnb_count=row["airbnb_count"],
                restaurants_count=row["restaurants_count"],
                coffee_shops_count=row["coffee_shops_count"],
                total_airbnb_capacity=row["total_airbnb_capacity"],
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
