"""Hotels Listings API endpoints"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson

router = APIRouter(prefix="/hotels", tags=["hotels"])


@router.get("")
async def get_hotels_listings(
    area: Optional[int] = Query(
        None, description="Filter by statistical area (stat_2022)"
    ),
    min_rating: Optional[float] = Query(None, description="Minimum rating value"),
    hotel_type: Optional[str] = Query(None, description="Filter by hotel type"),
):
    """
    Get hotel listings as GeoJSON FeatureCollection.
    Supports filtering by area, rating, and type.
    """
    pool = get_pool()

    conditions = ["hl.semel_yish = 2600"]
    params = []
    param_count = 0

    if area is not None:
        param_count += 1
        conditions.append(f"hl.stat_2022 = ${param_count}")
        params.append(area)

    if min_rating is not None:
        param_count += 1
        conditions.append(f"hl.rating_value >= ${param_count}")
        params.append(min_rating)

    if hotel_type is not None:
        param_count += 1
        conditions.append(f"hl.type = ${param_count}")
        params.append(hotel_type)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT 
            hl.uuid::text,
            hl.hotelid,
            hl.url,
            hl.name,
            hl.description,
            hl.type,
            hl.rating_value,
            hl.location_fulladdress,
            hl.stat_2022,
            ST_AsGeoJSON(hl.location)::jsonb as geometry
        FROM hotels_listings hl
        WHERE {where_clause}
        ORDER BY hl.rating_value DESC NULLS LAST, hl.name
    """

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {
                    "uuid": row["uuid"],
                    "hotelid": row["hotelid"],
                    "name": row["name"],
                    "url": row["url"],
                    "description": row["description"],
                    "type": row["type"],
                    "rating_value": (
                        float(row["rating_value"]) if row["rating_value"] else None
                    ),
                    "location_fulladdress": row["location_fulladdress"],
                    "stat_2022": row["stat_2022"],
                }

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
