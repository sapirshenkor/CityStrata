"""Unit tests for matching agent prompt formatters (no OpenAI calls)."""

from app.agents.matchingAgent import (
    _format_community_profile_text,
    _format_family_profile_text,
)
from app.models.community_profile import CommunityProfileBase
from tests.helpers.factories import evacuee_family_profile_base


def test_format_family_profile_includes_mobility_and_synagogue_needs():
    family = evacuee_family_profile_base(
        has_car=False,
        needs_synagogue=True,
        has_mobility_disability=True,
        seniors=1,
    )

    text = _format_family_profile_text(family)

    assert "4 members" in text
    assert "synagogue" in text.lower()
    assert "do not own a car" in text.lower()
    assert "mobility disability" in text.lower()
    assert "1 senior" in text


def test_format_community_profile_mentions_collective_group():
    community = CommunityProfileBase(
        community_name="Neighborhood A",
        leader_name="Leader",
        contact_phone="0501111111",
        contact_email="leader@example.com",
        total_families=10,
        total_people=40,
        infants=2,
        preschool=3,
        elementary=5,
        youth=5,
        adults=20,
        seniors=5,
        community_type="neighborhood",
        cohesion_importance=4,
        housing_preference="hotel",
        needs_synagogue=True,
        needs_community_center=False,
        needs_education_institution=True,
    )

    text = _format_community_profile_text(community)

    assert "Neighborhood A" in text
    assert "10 families" in text
    assert "40 people" in text
