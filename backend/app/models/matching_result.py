"""Matching agent result persisted in matching_results (macro cluster choice)."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MatchingResultResponse(BaseModel):
    """Selected matching row for a profile (joined via evacuee_family_profiles.selected_matching_result_id)."""

    id: UUID
    created_at: datetime
    profile_uuid: UUID
    run_id: UUID
    recommended_cluster_number: int = Field(description="Cluster index from clustering run")
    recommended_cluster: str
    confidence: str
    reasoning: str
    alternative_cluster_number: Optional[int] = None
    alternative_cluster: str
    alternative_reasoning: str
    flags: list[str] = Field(default_factory=list)
