"""Response models for the recommendations / agent-status overview list."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FamilyRecommendationOverview(BaseModel):
    """Evacuee family or multi-family group with agent pipeline status.

    Returned by the overview endpoint for the Recommendations panel.
    Individual families come from evacuee_family_profiles; multi-family
    groups come from multi_family_profiles (is_merged_profile = True).
    """

    profile_uuid: UUID = Field(
        description="UUID of the profile (evacuee_family_profiles or multi_family_profiles)."
    )
    family_name: str
    has_matching: bool = Field(
        description="True if selected_matching_result_id is not NULL."
    )
    has_tactical: bool = Field(
        description="True if a tactical response exists for this profile."
    )
    tactical_created_at: datetime | None = Field(
        default=None,
        description="created_at of the tactical row when has_tactical is True.",
    )
    cluster_number: int | None = Field(
        default=None,
        description="Macro cluster number from selected matching result, if any.",
    )
    is_merged_profile: bool = Field(
        default=False,
        description="True if this row is a multi-family group from multi_family_profiles.",
    )
