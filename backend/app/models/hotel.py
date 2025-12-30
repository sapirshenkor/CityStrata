"""Hotel Listing Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource


class HotelListingBase(BaseModel):
    """Base model for hotel listing"""

    hotelid: int  # Hotel listing ID
    url: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: Optional[str] = None
    rating_value: Optional[float] = None
    location_fulladdress: Optional[str] = None
    coordinates_latitude: float
    coordinates_longitude: float


class HotelListing(HotelListingBase, BaseResource):
    """Full hotel listing model"""

    uuid: str


class HotelListingCreate(HotelListingBase):
    """Model for creating new hotel listing"""

    pass


class HotelListingGeoJSON(BaseModel):
    """GeoJSON properties for Hotel"""

    hotelid: int
    name: str
    type: Optional[str]
    rating_value: Optional[float]
    url: Optional[str]
    location_fulladdress: Optional[str]
    stat_2022: int
