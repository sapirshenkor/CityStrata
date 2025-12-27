"""Coffee Shops API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/coffee-shops", tags=["coffee-shops"])


@router.get("")
async def get_coffee_shops(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    min_score: Optional[float] = Query(None, description="Minimum total score"),
):
    """
    Get coffee shops as GeoJSON FeatureCollection.
    Supports filtering by area and score.
    """
    pool = get_pool()

    conditions = ["cs.semel_yish = 2600", "cs.permanently_closed = false"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"cs.stat_2022 = ${param_count}")
        params.append(area)

    if min_score is not None:
        param_count += 1
        conditions.append(f"cs.total_score >= ${param_count}")
        params.append(min_score)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            cs.uuid::text,
            cs.cid,
            cs.title,
            cs.description,
            cs.category_name,
            cs.total_score,
            cs.temporarily_closed,
            cs.permanently_closed,
            cs.url,
            cs.website,
            cs.street,
            cs.stat_2022,
            ST_AsGeoJSON(cs.location)::jsonb as geometry
        FROM coffee_shops cs
        WHERE {where_clause}
        ORDER BY cs.total_score DESC NULLS LAST, cs.title
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "uuid": row["uuid"],
                    "cid": str(row["cid"]),
                    "title": row["title"],
                    "description": row["description"],
                    "category_name": row["category_name"],
                    "total_score": (
                        float(row["total_score"]) if row["total_score"] else None
                    ),
                    "temporarily_closed": row["temporarily_closed"],
                    "permanently_closed": row["permanently_closed"],
                    "url": row["url"],
                    "website": row["website"],
                    "street": row["street"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
