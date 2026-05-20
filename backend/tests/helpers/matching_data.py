"""Shared matching / clustering test payloads."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.agents.matchingAgent import Agent1Response


def sample_run_id() -> UUID:
    return UUID("22222222-2222-4222-8222-222222222222")


def cluster_dimensions_dict() -> dict[str, str]:
    return {
        "education": "high",
        "tourism": "medium",
        "food": "low",
        "community": "medium",
        "osm_infra": "high",
        "religious": "low",
    }


def cluster_profile_db_rows() -> list[dict]:
    return [
        {
            "cluster": 1,
            "name": "Residential - Secular",
            "short_description": "Secular residential",
            "dimensions": cluster_dimensions_dict(),
        },
        {
            "cluster": 2,
            "name": "Commercial Core",
            "short_description": "Commercial center",
            "dimensions": cluster_dimensions_dict(),
        },
    ]


def sample_agent1_response() -> Agent1Response:
    return Agent1Response(
        recommended_cluster="Residential - Secular",
        confidence="high",
        reasoning="התאמה גבוהה לאזור מגורים חילוני",
        alternative_cluster="Commercial Core",
        alternative_reasoning="חלופה עירונית",
        flags=["נדרשת נגישות"],
    )


def matching_result_db_row(
    *,
    profile_uuid: UUID | None = None,
    result_id: UUID | None = None,
) -> dict:
    now = datetime(2025, 3, 1, tzinfo=timezone.utc)
    return {
        "id": result_id or uuid4(),
        "created_at": now,
        "profile_uuid": profile_uuid or uuid4(),
        "run_id": sample_run_id(),
        "recommended_cluster_number": 1,
        "recommended_cluster": "Residential - Secular",
        "confidence": "high",
        "reasoning": "test",
        "alternative_cluster_number": 2,
        "alternative_cluster": "Commercial Core",
        "alternative_reasoning": "alt",
        "flags": ["flag"],
    }
