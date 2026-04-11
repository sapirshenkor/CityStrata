"""Community profile API — collective evacuee groups."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.core.database import get_pool
from app.models.community_profile import CommunityProfile, CommunityProfileCreate

router = APIRouter(prefix="/communities", tags=["communities"])

_SELECT_JOIN = """
    cp.id, cp.community_name, cp.leader_name, cp.contact_phone, cp.contact_email,
    cp.total_families, cp.total_people,
    cp.infants, cp.preschool, cp.elementary, cp.youth, cp.adults, cp.seniors,
    cp.community_type, cp.cohesion_importance,
    cp.housing_preference, cp.needs_synagogue, cp.needs_community_center,
    cp.needs_education_institution, cp.infrastructure_notes, cp.created_at,
    cp.selected_matching_result_id,
    mr.recommended_cluster_number AS matching_cluster_number
""".replace("\n", " ").strip()

_FROM_COMMUNITY = """
    FROM community_profiles cp
    LEFT JOIN community_matching_results mr ON mr.id = cp.selected_matching_result_id
""".replace("\n", " ").strip()

_RETURNING_INSERT = """
    id, community_name, leader_name, contact_phone, contact_email,
    total_families, total_people,
    infants, preschool, elementary, youth, adults, seniors,
    community_type, cohesion_importance,
    housing_preference, needs_synagogue, needs_community_center,
    needs_education_institution, infrastructure_notes, created_at,
    selected_matching_result_id
""".replace("\n", " ").strip()


def _row_to_profile(row) -> CommunityProfile:
    return CommunityProfile(
        id=row["id"],
        community_name=row["community_name"],
        leader_name=row["leader_name"],
        contact_phone=row["contact_phone"],
        contact_email=row["contact_email"],
        total_families=row["total_families"],
        total_people=row["total_people"],
        infants=row["infants"],
        preschool=row["preschool"],
        elementary=row["elementary"],
        youth=row["youth"],
        adults=row["adults"],
        seniors=row["seniors"],
        community_type=row["community_type"],
        cohesion_importance=row["cohesion_importance"],
        housing_preference=row["housing_preference"],
        needs_synagogue=row["needs_synagogue"],
        needs_community_center=row["needs_community_center"],
        needs_education_institution=row["needs_education_institution"],
        infrastructure_notes=row["infrastructure_notes"],
        created_at=row["created_at"],
        selected_matching_result_id=row.get("selected_matching_result_id"),
        matching_cluster_number=row.get("matching_cluster_number"),
    )


@router.get("", response_model=list[CommunityProfile])
async def list_community_profiles():
    """List all community profiles (newest first)."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT {_SELECT_JOIN} {_FROM_COMMUNITY} ORDER BY cp.created_at DESC"
            )
            return [_row_to_profile(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.get("/{community_id}", response_model=CommunityProfile)
async def get_community_profile(community_id: UUID):
    """Get one community profile by id."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_SELECT_JOIN} {_FROM_COMMUNITY} WHERE cp.id = $1",
                community_id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Community profile not found")
            return _row_to_profile(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.post("", response_model=CommunityProfile, status_code=201)
async def create_community_profile(body: CommunityProfileCreate):
    """Create a community profile."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO community_profiles (
                    community_name, leader_name, contact_phone, contact_email,
                    total_families, total_people,
                    infants, preschool, elementary, youth, adults, seniors,
                    community_type, cohesion_importance,
                    housing_preference, needs_synagogue, needs_community_center,
                    needs_education_institution, infrastructure_notes
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19
                )
                RETURNING
                """ + _RETURNING_INSERT,
                body.community_name,
                body.leader_name,
                body.contact_phone,
                str(body.contact_email),
                body.total_families,
                body.total_people,
                body.infants,
                body.preschool,
                body.elementary,
                body.youth,
                body.adults,
                body.seniors,
                body.community_type,
                body.cohesion_importance,
                body.housing_preference,
                body.needs_synagogue,
                body.needs_community_center,
                body.needs_education_institution,
                body.infrastructure_notes,
            )
            return _row_to_profile(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
