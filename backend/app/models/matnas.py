"""Matnas Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource


class MatnasBase(BaseModel):
    """Base model for matnas"""

    matnas_name: str
    full_address: Optional[str] = None
    person_in_charge: Optional[str] = None
    phone_number: Optional[str] = None
    activity_days: Optional[str] = None
    facility_area: Optional[int] = None
    occupancy: Optional[int] = None
    number_of_activity_rooms: Optional[str] = None
    location_lat: float
    location_lng: float


class Matnas(MatnasBase, BaseResource):
    """Full matnas model"""

    uuid: str


class MatnasCreate(MatnasBase):
    """Model for creating new matnas"""

    pass


class MatnasGeoJSON(BaseModel):
    """GeoJSON properties for Matnas"""

    matnas_name: str
    full_address: Optional[str]
    person_in_charge: Optional[str]
    phone_number: Optional[str]
    activity_days: Optional[str]
    facility_area: Optional[int]
    occupancy: Optional[int]
    number_of_activity_rooms: Optional[str]
    stat_2022: int
