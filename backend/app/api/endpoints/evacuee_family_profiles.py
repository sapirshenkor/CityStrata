"""Evacuee Family Profile API endpoints (CRUD)."""

from fastapi import APIRouter, HTTPException
from uuid import UUID

from app.core.database import get_pool
from app.models.evacuee_family_profiles import (
    EvacueeFamilyProfile,
    EvacueeFamilyProfileCreate,
    EvacueeFamilyProfileUpdate,
)


router = APIRouter(prefix="/evacuee-family-profiles", tags=["evacuee-family-profiles"])


def _row_to_profile(row) -> EvacueeFamilyProfile:
    """Map a DB row to EvacueeFamilyProfile."""
    return EvacueeFamilyProfile(
        id=row["id"],
        uuid=row["uuid"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        family_name=row["family_name"],
        contact_name=row["contact_name"],
        contact_phone=row["contact_phone"],
        contact_email=row["contact_email"],
        home_stat_2022=row["home_stat_2022"],
        city_name=row["city_name"],
        home_address=row["home_address"],
        total_people=row["total_people"],
        infants=row["infants"],
        preschool=row["preschool"],
        elementary=row["elementary"],
        youth=row["youth"],
        adults=row["adults"],
        seniors=row["seniors"],
        has_mobility_disability=row["has_mobility_disability"],
        has_car=row["has_car"],
        essential_education=row["essential_education"] or [],
        education_proximity_importance=row["education_proximity_importance"],
        religious_affiliation=row["religious_affiliation"],
        needs_synagogue=row["needs_synagogue"],
        culture_frequency=row["culture_frequency"],
        matnas_participation=row["matnas_participation"],
        social_venues_importance=row["social_venues_importance"],
        needs_community_proximity=row["needs_community_proximity"],
        accommodation_preference=row["accommodation_preference"],
        estimated_stay_duration=row["estimated_stay_duration"],
        needs_medical_proximity=row["needs_medical_proximity"],
        services_importance=row["services_importance"],
        notes=row["notes"],
    )


_SELECT_COLS = """
    id, uuid, created_at, updated_at,
    family_name, contact_name, contact_phone, contact_email, home_stat_2022,
    city_name, home_address,
    total_people, infants, preschool, elementary, youth, adults, seniors,
    has_mobility_disability, has_car,
    essential_education, education_proximity_importance,
    religious_affiliation, needs_synagogue, culture_frequency,
    matnas_participation, social_venues_importance, needs_community_proximity,
    accommodation_preference, estimated_stay_duration,
    needs_medical_proximity, services_importance, notes
""".replace("\n", " ").strip()


@router.get("", response_model=list[EvacueeFamilyProfile])
async def list_evacuee_family_profiles():
    """List all evacuee family profiles."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT {_SELECT_COLS} FROM evacuee_family_profiles ORDER BY created_at DESC"
            )
            return [_row_to_profile(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{profile_id}", response_model=EvacueeFamilyProfile)
async def get_evacuee_family_profile(profile_id: UUID):
    """Get a single evacuee family profile by UUID."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_SELECT_COLS} FROM evacuee_family_profiles WHERE uuid = $1",
                profile_id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
            return _row_to_profile(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("", response_model=EvacueeFamilyProfile, status_code=201)
async def create_evacuee_family_profile(body: EvacueeFamilyProfileCreate):
    """Create a new evacuee family profile."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO evacuee_family_profiles (
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
                    $27, $28, $29
                )
                RETURNING id, uuid, created_at, updated_at,
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
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.patch("/{profile_id}", response_model=EvacueeFamilyProfile)
async def update_evacuee_family_profile(profile_id: UUID, body: EvacueeFamilyProfileUpdate):
    """Update an evacuee family profile (partial update)."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            # Check existence
            existing = await conn.fetchrow(
                "SELECT id FROM evacuee_family_profiles WHERE uuid = $1", profile_id
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Profile not found")

            # Build dynamic UPDATE from only provided fields
            data = body.model_dump(exclude_unset=True)
            if not data:
                return await get_evacuee_family_profile(profile_id)

            set_parts = []
            params = []
            for i, (key, value) in enumerate(data.items(), start=1):
                set_parts.append(f"{key} = ${i}")
                params.append(value)
            params.append(profile_id)
            set_clause = ", ".join(set_parts)

            await conn.execute(
                f"""
                UPDATE evacuee_family_profiles
                SET {set_clause}
                WHERE uuid = ${len(params)}
                """,
                *params,
            )
            return await get_evacuee_family_profile(profile_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{profile_id}", status_code=204)
async def delete_evacuee_family_profile(profile_id: UUID):
    """Delete an evacuee family profile."""
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM evacuee_family_profiles WHERE uuid = $1", profile_id
            )
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Profile not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
