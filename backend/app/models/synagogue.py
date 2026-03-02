"""Synagogue Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource


class SynagogueBase(BaseModel):
    """Base model for synagogue"""

    name: str
    name_he: Optional[str] = None
    type: Optional[str] = None
    type_he: Optional[str] = None
    address: Optional[str] = None
    location_lat: float
    location_lng: float


class Synagogue(SynagogueBase, BaseResource):
    """Full synagogue model"""

    uuid: str


class SynagogueCreate(SynagogueBase):
    """Model for creating new synagogue"""

    pass


class SynagogueGeoJSON(BaseModel):
    """GeoJSON properties for Synagogue"""

    name: str
    name_he: Optional[str]
    type: Optional[str]
    type_he: Optional[str]
    address: Optional[str]
    stat_2022: int
