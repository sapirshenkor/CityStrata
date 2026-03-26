"""Tactical recommendation endpoints.

Exposes:
    GET /recommendations          — list all families that have a tactical response
    GET /recommendations/{uuid}   — latest recommendation for a specific family
"""

import json
from fastapi import APIRouter, HTTPException
from uuid import UUID

from app.core.database import get_pool
from app.models.tactical_agent_response import TacticalAgentResponse


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


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


# ── Helper ────────────────────────────────────────────────────────────────────

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
            rows = await conn.fetch(
                _SELECT_SQL + " ORDER BY tar.created_at DESC"
            )
            return [_row_to_recommendation(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")


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
