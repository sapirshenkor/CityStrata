"""Tactical recommendation endpoints.

Exposes:
    GET  /recommendations/overview        — all families + matching/tactical flags
    GET  /recommendations                 — list all families with a tactical response
    POST /recommendations/run/{uuid}      — run single-family tactical pipeline
    POST /recommendations/community/run   — run multi-family tactical pipeline
    GET  /recommendations/{uuid}          — latest recommendation for a profile
"""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

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

_FAMILY_SELECT_SQL = """
    SELECT
        ftr.id,
        ftr.created_at,
        ftr.profile_uuid,
        ftr.confidence,
        ftr.agent_output,
        ftr.radii_data,
        efp.family_name
    FROM family_tactical_responses ftr
    JOIN evacuee_family_profiles efp
        ON efp.uuid = ftr.profile_uuid
"""

_MULTI_FAMILY_SELECT_SQL = """
    SELECT
        mftr.id,
        mftr.created_at,
        mftr.multi_family_uuid AS profile_uuid,
        mftr.confidence,
        mftr.agent_output,
        mftr.radii_data,
        mfp.family_name
    FROM multi_family_tactical_responses mftr
    JOIN multi_family_profiles mfp
        ON mfp.uuid = mftr.multi_family_uuid
"""

_OVERVIEW_SQL = """
    SELECT
        efp.uuid AS profile_uuid,
        efp.family_name,
        (efp.selected_matching_result_id IS NOT NULL) AS has_matching,
        (ftr.id IS NOT NULL) AS has_tactical,
        ftr.created_at AS tactical_created_at,
        mr.recommended_cluster_number AS cluster_number,
        FALSE AS is_merged_profile
    FROM evacuee_family_profiles efp
    LEFT JOIN family_tactical_responses ftr
        ON ftr.profile_uuid = efp.uuid
    LEFT JOIN matching_results mr
        ON mr.id = efp.selected_matching_result_id

    UNION ALL

    SELECT
        mfp.uuid AS profile_uuid,
        mfp.family_name,
        (mfp.selected_matching_result_id IS NOT NULL) AS has_matching,
        (mftr.id IS NOT NULL) AS has_tactical,
        mftr.created_at AS tactical_created_at,
        mr.recommended_cluster_number AS cluster_number,
        TRUE AS is_merged_profile
    FROM multi_family_profiles mfp
    LEFT JOIN multi_family_tactical_responses mftr
        ON mftr.multi_family_uuid = mfp.uuid
    LEFT JOIN matching_results mr
        ON mr.id = mfp.selected_matching_result_id
"""

_ALL_RESPONSES_SQL = """
    SELECT id, created_at, profile_uuid, confidence,
           agent_output, radii_data, family_name
    FROM (
        SELECT
            ftr.id,
            ftr.created_at,
            ftr.profile_uuid,
            ftr.confidence,
            ftr.agent_output,
            ftr.radii_data,
            efp.family_name
        FROM family_tactical_responses ftr
        JOIN evacuee_family_profiles efp
            ON efp.uuid = ftr.profile_uuid

        UNION ALL

        SELECT
            mftr.id,
            mftr.created_at,
            mftr.multi_family_uuid AS profile_uuid,
            mftr.confidence,
            mftr.agent_output,
            mftr.radii_data,
            mfp.family_name
        FROM multi_family_tactical_responses mftr
        JOIN multi_family_profiles mfp
            ON mfp.uuid = mftr.multi_family_uuid
    ) combined
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
        radii = raw

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
    """All evacuee families + multi-family groups with agent status."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM (" + _OVERVIEW_SQL + ") overview "
                "ORDER BY is_merged_profile, family_name"
            )
            return [_row_to_overview(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")


@router.get("", response_model=list[TacticalAgentResponse])
async def list_recommendations():
    """
    Return all tactical responses (individual + multi-family),
    ordered by most recent first.
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                _ALL_RESPONSES_SQL + " ORDER BY created_at DESC"
            )
            return [_row_to_recommendation(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")


@router.post("/run/{profile_uuid}", response_model=TacticalAgentResponse)
async def run_tactical_recommendation(profile_uuid: UUID):
    """
    Run the tactical agent for an existing profile.
    Requires macro matching first (selected_matching_result_id set).
    Persists to family_tactical_responses and returns the row.
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
        logger.exception("Tactical pipeline error for %s", profile_uuid)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected tactical pipeline error for %s", profile_uuid)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    try:
        async with pool.acquire() as conn:
            rec_row = await conn.fetchrow(
                _FAMILY_SELECT_SQL + " WHERE ftr.profile_uuid = $1",
                profile_uuid,
            )
        if not rec_row:
            raise HTTPException(
                status_code=500,
                detail="Tactical run finished but no family_tactical_responses row was found.",
            )
        return _row_to_recommendation(rec_row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.post("/community/run", response_model=TacticalAgentResponse)
async def run_community_tactical_recommendation(body: CommunityRunRequest):
    """
    Run the multi-family tactical pipeline for a group of families sharing
    a cluster. Creates a multi_family_profiles row and persists the response
    to multi_family_tactical_responses.
    """
    try:
        mf_uuid = await execute_community_tactical_pipeline(body.family_uuids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="Multi-family tactical pipeline timed out. Check DATABASE_URL, OpenAI, and MCP.",
        ) from exc
    except (RuntimeError, OSError) as exc:
        logger.exception("Multi-family pipeline error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rec_row = await conn.fetchrow(
                _MULTI_FAMILY_SELECT_SQL + " WHERE mftr.multi_family_uuid = $1",
                mf_uuid,
            )
        if not rec_row:
            raise HTTPException(
                status_code=500,
                detail="Multi-family tactical run finished but no response row was found.",
            )
        return _row_to_recommendation(rec_row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.get("/{profile_uuid}", response_model=TacticalAgentResponse)
async def get_recommendation(profile_uuid: UUID):
    """
    Return the tactical recommendation for a profile UUID.

    Resolution order:
      1. Direct hit in family_tactical_responses (individual family).
      2. Direct hit in multi_family_tactical_responses (multi-family group UUID).
      3. The UUID is a *member* of a multi-family group — return that group's
         response so the frontend can display the shared recommendation.

    Returns 404 if no recommendation exists anywhere.
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                _FAMILY_SELECT_SQL + " WHERE ftr.profile_uuid = $1",
                profile_uuid,
            )
            if not row:
                row = await conn.fetchrow(
                    _MULTI_FAMILY_SELECT_SQL
                    + " WHERE mftr.multi_family_uuid = $1",
                    profile_uuid,
                )
            if not row:
                row = await conn.fetchrow(
                    _MULTI_FAMILY_SELECT_SQL
                    + " WHERE $1 = ANY(mfp.member_family_uuids)",
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
