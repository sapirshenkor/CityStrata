from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

PropertyType = Literal["apartment", "garden_apt", "private_house", "building", "other"]


class PropertyListingUnitBase(BaseModel):
    floor: int | None = None
    rooms: Decimal = Field(..., gt=0)
    bathrooms: int = Field(default=1, ge=0)

    has_accessibility: bool = False
    has_ac: bool = False
    has_bars: bool = False
    has_solar_heater: bool = False
    has_elevator: bool = False
    is_for_roommates: bool = False
    is_furnished: bool = False
    is_unit: bool = False
    is_kosher_kitchen: bool = False
    allows_pets: bool = False
    is_renovated: bool = False
    has_mamad: bool = False
    has_mamak: bool = False
    has_building_shelter: bool = False
    has_storage: bool = False

    built_sqm: Decimal | None = Field(default=None, ge=0)
    monthly_price: Decimal | None = Field(default=None, ge=0)
    rental_period: str | None = None
    is_occupied: bool = False
    description: str | None = None


class PropertyListingUnitCreate(PropertyListingUnitBase):
    pass


class PropertyListingUnitRead(PropertyListingUnitBase):
    id: UUID
    listing_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PropertyListingBase(BaseModel):
    property_type: PropertyType
    property_type_other: str | None = None

    city: str = Field(..., min_length=1)
    street: str = Field(..., min_length=1)
    house_number: str = Field(..., min_length=1)
    neighborhood: str | None = None

    total_floors: int | None = Field(default=None, gt=0)
    parking_spots: int = Field(default=0, ge=0)

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    publisher_name: str = Field(..., min_length=1)
    phone_number: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_other_property_type(self) -> PropertyListingBase:
        if self.property_type == "other":
            if not self.property_type_other or not self.property_type_other.strip():
                raise ValueError(
                    "property_type_other is required when property_type is 'other'"
                )
        elif self.property_type_other is not None:
            raise ValueError(
                "property_type_other must be null unless property_type is 'other'"
            )
        return self


class PropertyListingCreate(PropertyListingBase):
    units: list[PropertyListingUnitCreate] = Field(..., min_length=1)


class PropertyListingUpdate(BaseModel):
    property_type: PropertyType | None = None
    property_type_other: str | None = None
    city: str | None = Field(default=None, min_length=1)
    street: str | None = Field(default=None, min_length=1)
    house_number: str | None = Field(default=None, min_length=1)
    neighborhood: str | None = None
    total_floors: int | None = Field(default=None, gt=0)
    parking_spots: int | None = Field(default=None, ge=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    publisher_name: str | None = Field(default=None, min_length=1)
    phone_number: str | None = Field(default=None, min_length=1)
    units: list[PropertyListingUnitCreate] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_other_property_type(self) -> PropertyListingUpdate:
        if self.property_type == "other":
            if self.property_type_other is not None and not self.property_type_other.strip():
                raise ValueError("property_type_other cannot be empty when provided")
        return self


class PropertyListingRead(PropertyListingBase):
    id: UUID
    municipality_user_id: UUID
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    created_at: datetime
    updated_at: datetime
    units: list[PropertyListingUnitRead]

    model_config = ConfigDict(from_attributes=True)
