"""Pydantic models for hotel management CRUD (JSON API)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class HotelCreate(BaseModel):
    name: str = Field(..., min_length=1)
    location_fulladdress: str = Field(..., min_length=1)
    type: str | None = None
    description: str | None = None
    url: str | None = None
    rating_value: float | None = Field(default=None, ge=0, le=5)


class HotelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    location_fulladdress: str | None = None
    type: str | None = None
    description: str | None = None
    url: str | None = None
    rating_value: float | None = Field(default=None, ge=0, le=5)


class HotelRead(BaseModel):
    uuid: UUID
    hotelid: int
    url: str | None
    name: str
    description: str | None
    type: str | None
    rating_value: float | None
    location_fulladdress: str | None
    coordinates_latitude: float
    coordinates_longitude: float
    semel_yish: int
    stat_2022: int
    imported_at: datetime

    model_config = {"from_attributes": True}


def row_to_hotel_read(row: Any) -> HotelRead:
    return HotelRead(
        uuid=row["uuid"],
        hotelid=int(row["hotelid"]),
        url=row["url"],
        name=row["name"],
        description=row["description"],
        type=row["type"],
        rating_value=float(row["rating_value"]) if row["rating_value"] is not None else None,
        location_fulladdress=row["location_fulladdress"],
        coordinates_latitude=float(row["coordinates_latitude"]),
        coordinates_longitude=float(row["coordinates_longitude"]),
        semel_yish=int(row["semel_yish"]),
        stat_2022=int(row["stat_2022"]),
        imported_at=row["imported_at"],
    )
