"""Airbnb Listing Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource


class AirbnbListingBase(BaseModel):
    """Base model for Airbnb listing"""

    id: int  # Airbnb listing ID
    url: Optional[str] = None
    title: str
    description: Optional[str] = None
    price_qualifier: Optional[str] = None
    price_numeric: Optional[int] = None
    num_nights: Optional[int] = None
    price_per_night: Optional[float] = None
    rating_value: Optional[float] = None
    person_capacity: Optional[int] = None
    location_subtitle: Optional[str] = None
    coordinates_latitude: float
    coordinates_longitude: float


class AirbnbListing(AirbnbListingBase, BaseResource):
    """Full Airbnb listing model"""

    uuid: str


class AirbnbListingCreate(AirbnbListingBase):
    """Model for creating new Airbnb listing"""

    pass


class AirbnbListingGeoJSON(BaseModel):
    """GeoJSON properties for Airbnb"""

    id: int
    title: str
    price_per_night: Optional[float]
    rating_value: Optional[float]
    person_capacity: Optional[int]
    url: Optional[str]
    stat_2022: int
