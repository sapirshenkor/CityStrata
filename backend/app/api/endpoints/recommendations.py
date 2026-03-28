"""Tactical recommendation endpoints.

Exposes:
    GET /recommendations/overview — all families + matching/tactical flags (for Recommendations UI)
    GET /recommendations          — list all families that have a tactical response
    POST /recommendations/community/run — merged community profile + community tactical pipeline
    GET /recommendations/{uuid}   — latest recommendation for a specific family
"""

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.database import get_pool
from app.models.tactical_agent_response import TacticalAgentResponse
from app.models.recommendations_overview import FamilyRecommendationOverview
from app.services.tactical_pipeline import (
    execute_community_tactical_pipeline,
    execute_tactical_pipeline,
)


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class CommunityRunRequest(BaseModel):
    """Two or more profile UUIDs that share the same macro cluster (matching result)."""

    family_uuids: list[UUID] = Field(min_length=2)


# ── SQL ───────────────────────────────────────────────────────────────────────

_SELECT_SQL = """
    SELECT
        tar.id,
        tar.created_at,
        tar.profile_uuid,
        tar.confidence,
        tar.agent_output,
        tar.radii_data,
        efp.family_name
    FROM tactical_agent_response tar
    JOIN evacuee_family_profiles efp
        ON efp.uuid = tar.profile_uuid
"""

_OVERVIEW_SQL = """
     SELECT
        efp.uuid AS profile_uuid,
        efp.family_name,
        (efp.selected_matching_result_id IS NOT NULL) AS has_matching,
        (tar.id IS NOT NULL) AS has_tactical,
        tar.created_at AS tactical_created_at,
        mr.recommended_cluster_number AS cluster_number,
        (efp.family_name LIKE 'Community:%') AS is_merged_profile
    FROM evacuee_family_profiles efp
    LEFT JOIN tactical_agent_response tar
        ON tar.profile_uuid = efp.uuid
    LEFT JOIN matching_results mr
        ON mr.id = efp.selected_matching_result_id
"""


# ── Helper ────────────────────────────────────────────────────────────────────
def _row_to_overview(row) -> FamilyRecommendationOverview:
    """Map one DB row to FamilyRecommendationOverview."""
    return FamilyRecommendationOverview(
        profile_uuid=row["profile_uuid"],
        family_name=row["family_name"],
        has_matching=row["has_matching"],
        has_tactical=row["has_tactical"],
        tactical_created_at=row["tactical_created_at"],
        cluster_number=row["cluster_number"],
        is_merged_profile=row["is_merged_profile"],
    )


def _row_to_recommendation(row) -> TacticalAgentResponse:
    """Map a DB row to TacticalAgentResponse.

    asyncpg returns JSONB columns as dicts/lists already; guard against the
    rare case where it arrives as a plain JSON string.
    """
    raw = row["radii_data"]
    if isinstance(raw, str):
        radii = json.loads(raw)
    else:
        radii = raw  # None or already a list

    return TacticalAgentResponse(
        id=row["id"],
        created_at=row["created_at"],
        profile_uuid=row["profile_uuid"],
        confidence=row["confidence"],
        agent_output=row["agent_output"],
        radii_data=radii,
        family_name=row["family_name"],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/overview", response_model=list[FamilyRecommendationOverview])
async def list_families_recommendation_overview():
    """
    All evacuee families with agent status for the recommendations panel.

    Use has_tactical/ has_matching for styling.
    tactical_created_at for "last tactical run
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(_OVERVIEW_SQL + " ORDER BY efp.created_at DESC")
            return [_row_to_overview(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")


@router.get("", response_model=list[TacticalAgentResponse])
async def list_recommendations():
    """
    Return all families that have at least one tactical agent response,
    ordered by most recent first.

    Used by the frontend Recommendations tab to populate the family list.
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_SQL + " ORDER BY tar.created_at DESC")
            return [_row_to_recommendation(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")


@router.post("/run/{profile_uuid}", response_model=TacticalAgentResponse)
async def run_tactical_recommendation(profile_uuid: UUID):
    """
    Run the tactical agent for an existing profile.
    Requires macro matching first (selected_matching_result_id set).
    Persists to tactical_agent_response and returns the latest row (same shape as GET).
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT uuid, selected_matching_result_id
                FROM evacuee_family_profiles
                WHERE uuid = $1
                """,
                profile_uuid,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    if not row:
        raise HTTPException(status_code=404, detail="Evacuee family profile not found")
    if row["selected_matching_result_id"] is None:
        raise HTTPException(
            status_code=400,
            detail="Matching has not been run for this profile. Run the matching agent first.",
        )
    try:
        await execute_tactical_pipeline(profile_uuid)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="Tactical pipeline timed out. Check DATABASE_URL, OpenAI, and MCP tools.",
        ) from exc
    except (RuntimeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    try:
        async with pool.acquire() as conn:
            rec_row = await conn.fetchrow(
                _SELECT_SQL
                + " WHERE tar.profile_uuid = $1 ORDER BY tar.created_at DESC LIMIT 1",
                profile_uuid,
            )
        if not rec_row:
            raise HTTPException(
                status_code=500,
                detail="Tactical run finished but no tactical_agent_response row was found.",
            )
        return _row_to_recommendation(rec_row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.post("/community/run", response_model=TacticalAgentResponse)
async def run_community_tactical_recommendation(body: CommunityRunRequest):
    """
    Merge selected families into one community evacuee profile, run the community
    tactical MCP pipeline, persist the report on the new profile, and return it.
    """
    try:
        new_uuid = await execute_community_tactical_pipeline(body.family_uuids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="Community tactical pipeline timed out. Check DATABASE_URL, OpenAI, and MCP.",
        ) from exc
    except (RuntimeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rec_row = await conn.fetchrow(
                _SELECT_SQL
                + " WHERE tar.profile_uuid = $1 ORDER BY tar.created_at DESC LIMIT 1",
                new_uuid,
            )
        if not rec_row:
            raise HTTPException(
                status_code=500,
                detail="Community tactical run finished but no tactical_agent_response row.",
            )
        return _row_to_recommendation(rec_row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.get("/{profile_uuid}", response_model=TacticalAgentResponse)
async def get_recommendation(profile_uuid: UUID):
    """
    Return the most recent tactical recommendation for a specific family.

    Returns 404 if no recommendation exists yet for this profile.
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                _SELECT_SQL
                + " WHERE tar.profile_uuid = $1 ORDER BY tar.created_at DESC LIMIT 1",
                profile_uuid,
            )
            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"No recommendation found for profile {profile_uuid}",
                )
            return _row_to_recommendation(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
