"""Matching API: match family profile to best cluster."""

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.agents.matchingAgent import (
    Agent1Response,
    ClusterDimensions,
    ClusterProfile,
    match_family_to_cluster,
)
from app.core.database import get_pool
from app.models.evacuee_family_profiles import EvacueeFamilyProfile, EvacueeFamilyProfileBase

router = APIRouter(prefix="/matching", tags=["matching"])

_EVACUEE_PROFILE_SELECT_COLS = """
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


def _row_to_evacuee_profile(row) -> EvacueeFamilyProfile:
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


async def _load_latest_cluster_profiles() -> tuple[UUID, list[ClusterProfile]]:
    pool = get_pool()
    async with pool.acquire() as conn:
        run_id = await conn.fetchval(
            """
            SELECT id
            FROM public.clustering_runs
            ORDER BY created_at DESC
            LIMIT 1
            """
        )
        if not run_id:
            raise HTTPException(
                status_code=404,
                detail="No clustering run found. Run clustering first.",
            )

        rows = await conn.fetch(
            """
            SELECT cluster, name, short_description, dimensions
            FROM public.cluster_profiles
            WHERE run_id = $1
            ORDER BY cluster
            """,
            run_id,
        )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No cluster profiles found for latest clustering run.",
        )

    cluster_profiles: list[ClusterProfile] = []
    for r in rows:
        dims = r["dimensions"]
        if isinstance(dims, str):
            dims = json.loads(dims)
        dimensions = ClusterDimensions(**dims)
        cluster_profiles.append(
            ClusterProfile(
                cluster=r["cluster"],
                name=r["name"],
                short_description=r["short_description"],
                dimensions=dimensions,
            )
        )
    return run_id, cluster_profiles


async def _persist_matching_result(
    *,
    profile_uuid: UUID,
    run_id: UUID,
    recommended_cluster_number: int,
    alternative_cluster_number: int | None,
    result: Agent1Response,
) -> UUID:
    pool = get_pool()
    async with pool.acquire() as conn:
        inserted_id = await conn.fetchval(
            """
            INSERT INTO public.matching_results (
                profile_uuid,
                run_id,
                recommended_cluster_number,
                recommended_cluster,
                confidence,
                reasoning,
                alternative_cluster_number,
                alternative_cluster,
                alternative_reasoning,
                flags,
                agent_output
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
            RETURNING id
            """,
            profile_uuid,
            run_id,
            recommended_cluster_number,
            result.recommended_cluster,
            result.confidence,
            result.reasoning,
            alternative_cluster_number,
            result.alternative_cluster,
            result.alternative_reasoning,
            json.dumps(result.flags or []),
            json.dumps(result.model_dump()),
        )
        return inserted_id


@router.post("/cluster", response_model=Agent1Response)
async def match_cluster(family_profile: EvacueeFamilyProfileBase) -> Agent1Response:
    """
    Match a family profile to the best neighborhood cluster from the latest
    clustering run. Returns recommended cluster, confidence, reasoning,
    alternative cluster, and placement flags.
    """
    _, cluster_profiles = await _load_latest_cluster_profiles()

    try:
        return await match_family_to_cluster(family_profile, cluster_profiles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/cluster/{profile_id}", response_model=Agent1Response)
async def match_cluster_for_profile(profile_id: UUID) -> Agent1Response:
    """
    Match an existing evacuee family profile (by UUID) to the best neighborhood
    cluster from the latest clustering run.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT {_EVACUEE_PROFILE_SELECT_COLS} FROM evacuee_family_profiles WHERE uuid = $1",
            profile_id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Evacuee family profile not found")

    run_id, cluster_profiles = await _load_latest_cluster_profiles()
    profile = _row_to_evacuee_profile(row)

    try:
        result = await match_family_to_cluster(profile, cluster_profiles)
        name_to_cluster = {c.name: c.cluster for c in cluster_profiles}
        recommended_cluster_number = name_to_cluster.get(result.recommended_cluster)
        if recommended_cluster_number is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Agent returned a recommended_cluster name that does not match any cluster profile. "
                    f"recommended_cluster={result.recommended_cluster!r}"
                ),
            )

        alternative_cluster_number = name_to_cluster.get(result.alternative_cluster)

        matching_result_id = await _persist_matching_result(
            profile_uuid=profile_id,
            run_id=run_id,
            recommended_cluster_number=recommended_cluster_number,
            alternative_cluster_number=alternative_cluster_number,
            result=result,
        )
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.evacuee_family_profiles
                SET selected_matching_result_id = $1
                WHERE uuid = $2
                """,
                matching_result_id,
                profile_id,
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
