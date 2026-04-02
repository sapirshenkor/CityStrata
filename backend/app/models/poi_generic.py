"""
Pydantic models for a unified /api/poi/{category} JSON API.

Use these as a contract layer: map normalized payloads to each physical table's columns
in your route handlers (or a small service per category). Do not expose raw SQL table
names from user input without validation against an allow-list.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class PoiCategory(str, Enum):
    """URL segment and registry key — must match your FastAPI path + TABLE_REGISTRY."""

    AIRBNB_LISTINGS = "airbnb_listings"
    COFFEE_SHOPS = "coffee_shops"
    EDUCATIONAL_INSTITUTIONS = "educational_institutions"
    HOTEL_LISTINGS = "hotel_listings"
    MATNASIM = "matnasim"
    RESTAURANTS = "restaurants"
    SYNAGOGUES = "synagogues"


class PoiNormalizedCreate(BaseModel):
    """
    Minimal shared shape the frontend can POST; your backend maps to table columns.

    Example mapping:
    - airbnb_listings: name→title, address→location_subtitle
    - coffee_shops: name→title, address→street, type→category_name
    """

    name: str = Field(..., min_length=1)
    address: str = Field(..., min_length=1)
    type: str | None = None


class PoiNormalizedUpdate(BaseModel):
    """PATCH body: only set fields that should change."""

    name: str | None = Field(default=None, min_length=1)
    address: str | None = None
    type: str | None = None


class PoiErrorDetail(BaseModel):
    detail: str


class PoiListEnvelope(BaseModel):
    category: PoiCategory
    items: list[dict[str, Any]]


class PoiMutationResponse(BaseModel):
    category: PoiCategory
    id: UUID | str
    row: dict[str, Any]
