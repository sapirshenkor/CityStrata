"""Shared Pydantic models used across all resources"""

from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class Point(BaseModel):
    """Point geometry model"""

    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class Geometry(BaseModel):
    """Generic geometry model for GeoJSON"""

    type: str
    coordinates: Any


class GeoJSONFeature(BaseModel):
    """GeoJSON Feature model"""

    type: str = "Feature"
    geometry: Geometry
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    """GeoJSON FeatureCollection model"""

    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


class BaseResource(BaseModel):
    """Base model for all resources with location"""

    semel_yish: int = 2600
    stat_2022: int
    imported_at: Optional[datetime] = None
