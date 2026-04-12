"""Pydantic models for collective community profiles (complements evacuee families)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

CommunityType = Literal["neighborhood", "religious", "kibbutz_moshav", "interest_group"]
HousingPreference = Literal["hotel", "scattered_apartments"]


class CommunityProfileBase(BaseModel):
    """Shared fields for community profile create/read."""

    community_name: str = Field(..., min_length=1, max_length=500)
    leader_name: str = Field(..., min_length=1, max_length=300)
    contact_phone: str = Field(..., min_length=3, max_length=50)
    contact_email: EmailStr

    total_families: int = Field(..., ge=0)
    total_people: int = Field(..., gt=0)

    infants: int = Field(default=0, ge=0)
    preschool: int = Field(default=0, ge=0)
    elementary: int = Field(default=0, ge=0)
    youth: int = Field(default=0, ge=0)
    adults: int = Field(default=0, ge=0)
    seniors: int = Field(default=0, ge=0)

    community_type: CommunityType
    cohesion_importance: int = Field(..., ge=1, le=5)
    housing_preference: HousingPreference

    needs_synagogue: bool = False
    needs_community_center: bool = False
    needs_education_institution: bool = False

    infrastructure_notes: str | None = None

    @model_validator(mode="after")
    def composition_sum_matches_total_people(self) -> CommunityProfileBase:
        """Age buckets must sum to total_people (same idea as evacuee family composition)."""
        s = (
            self.infants
            + self.preschool
            + self.elementary
            + self.youth
            + self.adults
            + self.seniors
        )
        if s != self.total_people:
            raise ValueError(
                "Age breakdown (infants + preschool + elementary + youth + adults + seniors) "
                f"must equal total_people (got {s} vs total_people={self.total_people})"
            )
        return self


class CommunityProfileCreate(CommunityProfileBase):
    """Payload for creating a community profile."""

    pass


class CommunityProfile(CommunityProfileBase):
    """Community profile as stored and returned from the API."""

    id: UUID
    created_at: datetime
    selected_matching_result_id: UUID | None = None
    matching_cluster_number: int | None = Field(
        default=None,
        description="Recommended cluster # from macro matching when linked",
    )

    model_config = ConfigDict(from_attributes=True)
