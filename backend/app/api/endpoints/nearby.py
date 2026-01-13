"""Nearby Resources API endpoints"""

from fastapi import APIRouter, HTTPException, Query
import asyncpg

from app.core.database import get_pool
from app.services.geojson import build_geojson_feature_collection, parse_postgis_geojson
from app.models.evacuation import NearbySearchRequest

router = APIRouter(prefix="/nearby", tags=["nearby"])


@router.get("")
async def get_nearby_resources(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius: int = Query(1000, description="Radius in meters", ge=1, le=10000),
    type: str = Query(
        ..., description="Resource type: airbnb, institution, restaurant, coffee_shop"
    ),
):
    """
    Get resources within radius of a point.
    Returns GeoJSON FeatureCollection.
    """
    pool = get_pool()

    # Validate resource type
    valid_types = ["airbnb", "institution", "restaurant", "coffee_shop"]
    if type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid resource type. Must be one of: {', '.join(valid_types)}",
        )

    # Build query based on resource type
    if type == "airbnb":
        query = """
            SELECT 
                al.uuid::text as id,
                al.id as listing_id,
                al.title,
                al.price_per_night,
                al.rating_value,
                al.person_capacity,
                al.url,
                al.stat_2022,
                ST_AsGeoJSON(al.location)::jsonb as geometry,
                ST_Distance(al.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
            FROM airbnb_listings al
            WHERE al.semel_yish = 2600
              AND ST_DWithin(
                  al.location::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters
            LIMIT 100
        """
        property_fields = [
            "id",
            "listing_id",
            "title",
            "price_per_night",
            "rating_value",
            "person_capacity",
            "url",
            "stat_2022",
            "distance_meters",
        ]

    elif type == "institution":
        query = """
            SELECT 
                ei.id::text as id,
                ei.institution_code,
                ei.institution_name,
                ei.address,
                ei.education_phase,
                ei.type_of_education,
                ei.stat_2022,
                ST_AsGeoJSON(ei.location)::jsonb as geometry,
                ST_Distance(ei.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
            FROM educational_institutions ei
            WHERE ei.semel_yish = 2600
              AND ST_DWithin(
                  ei.location::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters
            LIMIT 100
        """
        property_fields = [
            "id",
            "institution_code",
            "institution_name",
            "address",
            "education_phase",
            "type_of_education",
            "stat_2022",
            "distance_meters",
        ]

    elif type == "restaurant":
        query = """
            SELECT 
                r.uuid::text as id,
                r.cid,
                r.title,
                r.category_name,
                r.total_score,
                r.url,
                r.stat_2022,
                ST_AsGeoJSON(r.location)::jsonb as geometry,
                ST_Distance(r.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
            FROM restaurants r
            WHERE r.semel_yish = 2600
              AND r.permanently_closed = false
              AND ST_DWithin(
                  r.location::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters
            LIMIT 100
        """
        property_fields = [
            "id",
            "cid",
            "title",
            "category_name",
            "total_score",
            "url",
            "stat_2022",
            "distance_meters",
        ]

    else:  # coffee_shop
        query = """
            SELECT 
                cs.uuid::text as id,
                cs.cid,
                cs.title,
                cs.category_name,
                cs.total_score,
                cs.url,
                cs.stat_2022,
                ST_AsGeoJSON(cs.location)::jsonb as geometry,
                ST_Distance(cs.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
            FROM coffee_shops cs
            WHERE cs.semel_yish = 2600
              AND cs.permanently_closed = false
              AND ST_DWithin(
                  cs.location::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters
            LIMIT 100
        """
        property_fields = [
            "id",
            "cid",
            "title",
            "category_name",
            "total_score",
            "url",
            "stat_2022",
            "distance_meters",
        ]

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, lat, lon, radius)

            features = []
            for row in rows:
                geometry = parse_postgis_geojson(row["geometry"])
                properties = {}

                for field in property_fields:
                    value = row.get(field)
                    if isinstance(value, float):
                        properties[field] = float(value)
                    elif value is not None:
                        properties[field] = str(value) if field in ["cid"] else value
                    else:
                        properties[field] = None

                features.append(
                    {"type": "Feature", "geometry": geometry, "properties": properties}
                )

            return build_geojson_feature_collection(features)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
