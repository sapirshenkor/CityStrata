"""Coffee Shop Pydantic models"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from .common import BaseResource


class CoffeeShopBase(BaseModel):
    """Base model for coffee shop"""

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


class CoffeeShop(CoffeeShopBase, BaseResource):
    """Full coffee shop model"""

    uuid: str


class CoffeeShopCreate(CoffeeShopBase):
    """Model for creating new coffee shop"""

    pass


class CoffeeShopGeoJSON(BaseModel):
    """GeoJSON properties for coffee shop"""

    cid: str
    title: str
    category_name: Optional[str]
    total_score: Optional[float]
    temporarily_closed: bool
    permanently_closed: bool
    url: Optional[str]
    stat_2022: int
