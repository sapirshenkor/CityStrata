"""OSM Facility Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource


class OSMFacilityBase(BaseModel):
    """Base model for OSM facility"""

    name: Optional[str] = None
    facility_type: str
    location_lat: float
    location_lng: float


class OSMFacility(OSMFacilityBase, BaseResource):
    """Full OSM facility model"""

    uuid: str


class OSMFacilityCreate(OSMFacilityBase):
    """Model for creating new OSM facility"""

    pass


class OSMFacilityGeoJSON(BaseModel):
    """GeoJSON properties for OSM Facility"""

    name: Optional[str]
    facility_type: str
    stat_2022: int
