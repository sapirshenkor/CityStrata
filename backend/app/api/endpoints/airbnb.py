"""Airbnb Listings API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/airbnb", tags=["airbnb"])


@router.get("")
async def get_airbnb_listings(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    min_capacity: Optional[int] = Query(None, description="Minimum person capacity"),
    min_rating: Optional[float] = Query(None, description="Minimum rating value"),
    max_price: Optional[float] = Query(None, description="Maximum price per night"),
):
    """
    Get Airbnb listings as GeoJSON FeatureCollection.
    Supports filtering by area, capacity, rating, and price.
    """
    pool = get_pool()

    conditions = ["al.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"al.stat_2022 = ${param_count}")
        params.append(area)

    if min_capacity is not None:
        param_count += 1
        conditions.append(f"al.person_capacity >= ${param_count}")
        params.append(min_capacity)

    if min_rating is not None:
        param_count += 1
        conditions.append(f"al.rating_value >= ${param_count}")
        params.append(min_rating)

    if max_price is not None:
        param_count += 1
        conditions.append(f"al.price_per_night <= ${param_count}")
        params.append(max_price)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            al.uuid::text,
            al.id,
            al.url,
            al.title,
            al.description,
            al.price_qualifier,
            al.price_numeric,
            al.num_nights,
            al.price_per_night,
            al.rating_value,
            al.person_capacity,
            al.location_subtitle,
            al.stat_2022,
            ST_AsGeoJSON(al.location)::jsonb as geometry
        FROM airbnb_listings al
        WHERE {where_clause}
        ORDER BY al.person_capacity DESC NULLS LAST, al.rating_value DESC NULLS LAST
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "id": row["id"],
                    "uuid": row["uuid"],
                    "title": row["title"],
                    "url": row["url"],
                    "description": row["description"],
                    "price_qualifier": row["price_qualifier"],
                    "price_numeric": row["price_numeric"],
                    "num_nights": row["num_nights"],
                    "price_per_night": (
                        float(row["price_per_night"])
                        if row["price_per_night"]
                        else None
                    ),
                    "rating_value": (
                        float(row["rating_value"]) if row["rating_value"] else None
                    ),
                    "person_capacity": row["person_capacity"],
                    "location_subtitle": row["location_subtitle"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
