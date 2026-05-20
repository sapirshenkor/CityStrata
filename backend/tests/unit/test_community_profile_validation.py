"""Unit tests for community profile Pydantic validation."""

import pytest
from pydantic import ValidationError

from app.models.community_profile import CommunityProfileCreate


def _valid_payload(**overrides):
    base = {
        "community_name": "Group A",
        "leader_name": "Leader",
        "contact_phone": "0501234567",
        "contact_email": "leader@example.com",
        "total_families": 5,
        "total_people": 20,
        "infants": 1,
        "preschool": 2,
        "elementary": 3,
        "youth": 4,
        "adults": 8,
        "seniors": 2,
        "community_type": "neighborhood",
        "cohesion_importance": 4,
        "housing_preference": "hotel",
    }
    base.update(overrides)
    return base


def test_community_profile_create_accepts_matching_age_composition():
    profile = CommunityProfileCreate(**_valid_payload())
    assert profile.total_people == 20


def test_community_profile_create_rejects_mismatched_composition():
    with pytest.raises(ValidationError) as exc:
        CommunityProfileCreate(**_valid_payload(total_people=99))
    assert "total_people" in str(exc.value).lower() or "sum" in str(exc.value).lower()
