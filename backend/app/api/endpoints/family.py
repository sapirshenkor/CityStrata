"""Family portal: authenticated CRUD for evacuee profiles owned by the current user."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.endpoints.evacuee_family_profiles import _row_to_profile, _SELECT_COLS
from app.core.auth import get_current_user
from app.core.database import get_pool
from app.models.evacuee_family_profiles import (
    EvacueeFamilyProfile,
    EvacueeFamilyProfileCreate,
    EvacueeFamilyProfileUpdate,
)
from app.models.municipality_user import MunicipalityUserRecord, UserResponse

router = APIRouter(prefix="/family/me", tags=["family"])


def _record_to_user_response(m: MunicipalityUserRecord) -> UserResponse:
    return UserResponse(
        id=m.id,
        email=m.email,
        first_name=m.first_name,
        last_name=m.last_name,
        phone_number=m.phone_number,
        semel_yish=m.semel_yish,
        department=m.department,
        role=m.role,
        is_active=m.is_active,
        created_at=m.created_at,
    )


class FamilyDashboardSummary(BaseModel):
    profile_count: int
    profiles_with_matching_count: int


class FamilyDashboardResponse(BaseModel):
    user: UserResponse
    profiles: list[EvacueeFamilyProfile]
    summary: FamilyDashboardSummary


@router.get("/dashboard", response_model=FamilyDashboardResponse)
async def family_dashboard(
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT {_SELECT_COLS}
                FROM evacuee_family_profiles
                WHERE user_id = $1
                ORDER BY created_at DESC
                """,
                current.id,
            )
            profiles = [_row_to_profile(row) for row in rows]
            count_row = await conn.fetchrow(
                """
                SELECT
                    COUNT(*)::int AS profile_count,
                    COUNT(*) FILTER (WHERE selected_matching_result_id IS NOT NULL)::int
                        AS profiles_with_matching_count
                FROM evacuee_family_profiles
                WHERE user_id = $1
                """,
                current.id,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    summary = FamilyDashboardSummary(
        profile_count=count_row["profile_count"] if count_row else 0,
        profiles_with_matching_count=(
            count_row["profiles_with_matching_count"] if count_row else 0
        ),
    )
    return FamilyDashboardResponse(
        user=_record_to_user_response(current),
        profiles=profiles,
        summary=summary,
    )


@router.get("/profiles", response_model=list[EvacueeFamilyProfile])
async def list_my_profiles(
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT {_SELECT_COLS}
                FROM evacuee_family_profiles
                WHERE user_id = $1
                ORDER BY created_at DESC
                """,
                current.id,
            )
            return [_row_to_profile(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.get("/profiles/{profile_uuid}", response_model=EvacueeFamilyProfile)
async def get_my_profile(
    profile_uuid: UUID,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT {_SELECT_COLS}
                FROM evacuee_family_profiles
                WHERE uuid = $1 AND user_id = $2
                """,
                profile_uuid,
                current.id,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _row_to_profile(row)


@router.post("/profiles", response_model=EvacueeFamilyProfile, status_code=201)
async def create_my_profile(
    body: EvacueeFamilyProfileCreate,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO evacuee_family_profiles (
                    user_id,
                    family_name, contact_name, contact_phone, contact_email,
                    home_stat_2022, city_name, home_address,
                    total_people, infants, preschool, elementary, youth, adults, seniors,
                    has_mobility_disability, has_car,
                    essential_education, education_proximity_importance,
                    religious_affiliation, needs_synagogue, culture_frequency,
                    matnas_participation, social_venues_importance, needs_community_proximity,
                    accommodation_preference, estimated_stay_duration,
                    needs_medical_proximity, services_importance, notes
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                    $27, $28, $29, $30
                )
                RETURNING id, uuid, created_at, updated_at, selected_matching_result_id,
                    family_name, contact_name, contact_phone, contact_email, home_stat_2022,
                    city_name, home_address,
                    total_people, infants, preschool, elementary, youth, adults, seniors,
                    has_mobility_disability, has_car,
                    essential_education, education_proximity_importance,
                    religious_affiliation, needs_synagogue, culture_frequency,
                    matnas_participation, social_venues_importance, needs_community_proximity,
                    accommodation_preference, estimated_stay_duration,
                    needs_medical_proximity, services_importance, notes
                """,
                current.id,
                body.family_name,
                body.contact_name,
                body.contact_phone,
                body.contact_email,
                body.home_stat_2022,
                body.city_name,
                body.home_address,
                body.total_people,
                body.infants,
                body.preschool,
                body.elementary,
                body.youth,
                body.adults,
                body.seniors,
                body.has_mobility_disability,
                body.has_car,
                body.essential_education,
                body.education_proximity_importance,
                body.religious_affiliation,
                body.needs_synagogue,
                body.culture_frequency,
                body.matnas_participation,
                body.social_venues_importance,
                body.needs_community_proximity,
                body.accommodation_preference,
                body.estimated_stay_duration,
                body.needs_medical_proximity,
                body.services_importance,
                body.notes,
            )
            return _row_to_profile(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.patch("/profiles/{profile_uuid}", response_model=EvacueeFamilyProfile)
async def update_my_profile(
    profile_uuid: UUID,
    body: EvacueeFamilyProfileUpdate,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id FROM evacuee_family_profiles
                WHERE uuid = $1 AND user_id = $2
                """,
                profile_uuid,
                current.id,
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Profile not found")

            data = body.model_dump(exclude_unset=True)
            if not data:
                row = await conn.fetchrow(
                    f"""
                    SELECT {_SELECT_COLS}
                    FROM evacuee_family_profiles
                    WHERE uuid = $1 AND user_id = $2
                    """,
                    profile_uuid,
                    current.id,
                )
                if not row:
                    raise HTTPException(status_code=404, detail="Profile not found")
                return _row_to_profile(row)

            set_parts = []
            params: list = []
            for i, (key, value) in enumerate(data.items(), start=1):
                set_parts.append(f"{key} = ${i}")
                params.append(value)
            params.append(profile_uuid)
            params.append(current.id)
            set_clause = ", ".join(set_parts)
            n = len(params)

            await conn.execute(
                f"""
                UPDATE evacuee_family_profiles
                SET {set_clause}
                WHERE uuid = ${n - 1} AND user_id = ${n}
                """,
                *params,
            )
            row = await conn.fetchrow(
                f"""
                SELECT {_SELECT_COLS}
                FROM evacuee_family_profiles
                WHERE uuid = $1 AND user_id = $2
                """,
                profile_uuid,
                current.id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
            return _row_to_profile(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
