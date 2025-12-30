"""Restaurant Pydantic models"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from .common import BaseResource


class RestaurantBase(BaseModel):
    """Base model for restaurant"""

    cid: str  # Numeric as string to handle large numbers
    title: str
    description: Optional[str] = None
    category_name: Optional[str] = None
    total_score: Optional[float] = None
    temporarily_closed: bool = False
    permanently_closed: bool = False
    url: Optional[str] = None
    website: Optional[str] = None
    street: Optional[str] = None
    location_lat: float
    location_lng: float
    activity_times: Optional[Dict[str, Any]] = None


class Restaurant(RestaurantBase, BaseResource):
    """Full restaurant model"""

    uuid: str


class RestaurantCreate(RestaurantBase):
    """Model for creating new restaurant"""

    pass


class RestaurantGeoJSON(BaseModel):
    """GeoJSON properties for restaurant"""

    cid: str
    title: str
    category_name: Optional[str]
    total_score: Optional[float]
    temporarily_closed: bool
    permanently_closed: bool
    url: Optional[str]
    stat_2022: int
