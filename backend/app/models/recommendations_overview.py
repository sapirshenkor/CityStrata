"""Response models for the recommendations / agent-status overview list."""

from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FamilyRecommendationOverview(BaseModel):
    """evacuee family + Agent pipeline status overview.

    - has_matching: True if matching agent has run for this family.
    - has_tactical: True if tactical agent has run for this family.
    - tactical_created_at: datetime of the tactical agent run, if it has run.
    """

    profile_uuid: UUID = Field(description="UUID of the evacuee family profile.")
    family_name: str
    has_matching: bool = Field(
        description="True if selecting_matching_result_id is not NULL."
    )
    has_tactical: bool = Field(
        description="True if tactical_agent_response_id is not NULL."
    )
    tcatical_created_at: datetime | None = Field(
        default=None,
        description="created_at of the tactical row when has_tactical is True.",
    )
