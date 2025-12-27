"""Main API router that includes all endpoint routers"""

from fastapi import APIRouter

from app.api.endpoints import (
    statistical_areas,
    institutions,
    airbnb,
    restaurants,
    coffee_shops,
    evacuation,
    nearby,
)

api_router = APIRouter(prefix="/api")

# Include all endpoint routers
api_router.include_router(statistical_areas.router)
api_router.include_router(institutions.router)
api_router.include_router(airbnb.router)
api_router.include_router(restaurants.router)
api_router.include_router(coffee_shops.router)
api_router.include_router(evacuation.router)
api_router.include_router(nearby.router)
