"""Test data builders aligned with production Pydantic models."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.models.evacuee_family_profiles import EvacueeFamilyProfileBase
from app.models.municipality_user import MunicipalityUserRecord


def sample_user_id() -> UUID:
    return UUID("11111111-1111-4111-8111-111111111111")


def other_user_id() -> UUID:
    return UUID("22222222-2222-4222-8222-222222222222")


def municipality_user(
    *,
    role: str = "editor",
    is_active: bool = True,
    user_id: UUID | None = None,
) -> MunicipalityUserRecord:
    uid = user_id or sample_user_id()
    now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    return MunicipalityUserRecord(
        id=uid,
        email="editor@example.com",
        first_name="Test",
        last_name="Editor",
        phone_number="0500000000",
        semel_yish=2600,
        department="QA",
        role=role,
        is_active=is_active,
        last_login_at=now,
        created_at=now,
        updated_at=now,
    )


def evacuee_family_profile_base(**overrides: object) -> EvacueeFamilyProfileBase:
    data: dict = {
        "family_name": "Cohen",
        "contact_name": "Dana Cohen",
        "contact_phone": "0501234567",
        "contact_email": "dana@example.com",
        "home_stat_2022": 100,
        "city_name": "Eilat",
        "home_address": "1 Herzl St",
        "total_people": 4,
        "infants": 0,
        "preschool": 1,
        "elementary": 1,
        "youth": 0,
        "adults": 2,
        "seniors": 0,
        "has_mobility_disability": False,
        "has_car": False,
        "religious_affiliation": "traditional",
        "needs_synagogue": True,
        "education_proximity_importance": 4,
        "social_venues_importance": 3,
        "services_importance": 4,
        "accommodation_preference": "airbnb",
        "needs_medical_proximity": False,
    }
    data.update(overrides)
    return EvacueeFamilyProfileBase(**data)  # type: ignore[arg-type]


def evacuee_profile_db_row(
    *,
    user_id: UUID | None = None,
    profile_uuid: UUID | None = None,
    selected_matching_result_id: UUID | None = None,
    family_name: str = "Cohen",
) -> dict:
    now = datetime(2025, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
    return {
        "id": 1,
        "uuid": profile_uuid or uuid4(),
        "created_at": now,
        "updated_at": now,
        "selected_matching_result_id": selected_matching_result_id,
        "family_name": family_name,
        "contact_name": "Dana Cohen",
        "contact_phone": "0501234567",
        "contact_email": "dana@example.com",
        "home_stat_2022": 100,
        "city_name": "Eilat",
        "home_address": "1 Herzl St",
        "total_people": 4,
        "infants": 0,
        "preschool": 1,
        "elementary": 1,
        "youth": 0,
        "adults": 2,
        "seniors": 0,
        "has_mobility_disability": False,
        "has_car": False,
        "essential_education": [],
        "education_proximity_importance": 4,
        "religious_affiliation": "traditional",
        "needs_synagogue": True,
        "culture_frequency": "rarely",
        "matnas_participation": False,
        "social_venues_importance": 3,
        "needs_community_proximity": False,
        "accommodation_preference": "airbnb",
        "estimated_stay_duration": None,
        "needs_medical_proximity": False,
        "services_importance": 4,
        "notes": None,
        "user_id": user_id or sample_user_id(),
    }


def tactical_response_db_row(
    *,
    profile_uuid: UUID | None = None,
    family_name: str = "Cohen",
) -> dict:
    now = datetime(2025, 3, 2, tzinfo=timezone.utc)
    return {
        "id": uuid4(),
        "created_at": now,
        "profile_uuid": profile_uuid or uuid4(),
        "confidence": "high",
        "agent_output": "# Tactical report\n\nSafe zone identified.",
        "radii_data": [{"hub_label": "education", "radius_m": 500}],
        "family_name": family_name,
    }


def property_listing_db_row(
    *,
    listing_id: UUID | None = None,
    owner_id: UUID | None = None,
) -> dict:
    now = datetime(2025, 4, 1, tzinfo=timezone.utc)
    return {
        "id": listing_id or uuid4(),
        "municipality_user_id": owner_id or sample_user_id(),
        "property_type": "apartment",
        "property_type_other": None,
        "city": "Eilat",
        "street": "Herzl",
        "house_number": "1",
        "neighborhood": "Center",
        "total_floors": 4,
        "parking_spots": 1,
        "latitude": 29.55,
        "longitude": 34.95,
        "publisher_name": "Publisher",
        "phone_number": "0500000000",
        "created_at": now,
        "updated_at": now,
    }


def stat_area_row(
    *,
    stat_2022: int = 100,
    area_id: str | None = None,
) -> dict:
    return {
        "id": area_id or str(uuid4()),
        "stat_2022": stat_2022,
        "area_m2": 500000.0,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[34.95, 29.55], [34.96, 29.55], [34.96, 29.56], [34.95, 29.56], [34.95, 29.55]]],
        },
        "properties": {"label": "Test area"},
        "source": "test",
    }
