"""Matching API: match family profile to best cluster."""

import json

from fastapi import APIRouter, HTTPException

from app.agents.matchingAgent import (
    Agent1Response,
    ClusterDimensions,
    ClusterProfile,
    FamilyProfile,
    match_family_to_cluster,
)
from app.core.database import get_pool

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/cluster", response_model=Agent1Response)
async def match_cluster(family_profile: FamilyProfile) -> Agent1Response:
    """
    Match a family profile to the best neighborhood cluster from the latest
    clustering run. Returns recommended cluster, confidence, reasoning,
    alternative cluster, and placement flags.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT cluster, name, short_description, dimensions
            FROM public.cluster_profiles
            WHERE run_id = (
                SELECT id FROM public.clustering_runs
                ORDER BY created_at DESC
                LIMIT 1
            )
            ORDER BY cluster
            """
        )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No clustering run found. Run clustering first.",
        )

    cluster_profiles = []
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

    try:
        return await match_family_to_cluster(family_profile, cluster_profiles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
