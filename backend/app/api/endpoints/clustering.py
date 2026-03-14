"""Clustering API: run pipeline and fetch assignments."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.core.database import get_pool
from ML.clustering import run_clustering_pipeline

router = APIRouter(prefix="/clustering", tags=["clustering"])


@router.post("/run")
async def run_clustering(k: int = Query(4, ge=2, le=10, description="Number of clusters")):
    """
    Run the clustering pipeline: load PCA data, K-Means, persist to DB.
    Returns run summary and assignments.
    """
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            result = await run_clustering_pipeline(conn, k=k)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profiles")
async def get_cluster_profiles(
    run_id: UUID | None = Query(None, description="Run ID; if omitted, latest run is used"),
):
    """
    Get cluster profiles (names, descriptions, dimensions) for a run (or the latest run).
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        if run_id is None:
            run = await conn.fetchrow(
                """
                SELECT id
                FROM public.clustering_runs
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            if not run:
                return {"run_id": None, "profiles": []}
            run_id = run["id"]

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
            # If the run exists but has no profiles yet, return empty list.
            exists = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM public.clustering_runs WHERE id = $1)", run_id
            )
            if not exists:
                raise HTTPException(status_code=404, detail="Run not found")
            return {"run_id": str(run_id), "profiles": []}

    profiles = [
        {
            "cluster": r["cluster"],
            "name": r["name"],
            "short_description": r["short_description"],
            "dimensions": r["dimensions"],
        }
        for r in rows
    ]
    return {"run_id": str(run_id), "profiles": profiles}

@router.get("/assignments")
async def get_assignments(
    run_id: UUID | None = Query(None, description="Run ID; if omitted, latest run is used"),
):
    """
    Get cluster assignments for a run (or the latest run).
    Returns list of { stat_2022, cluster, cluster_label }.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        if run_id is not None:
            rows = await conn.fetch(
                """
                SELECT stat_2022, cluster, cluster_label
                FROM public.cluster_assignments
                WHERE run_id = $1
                ORDER BY stat_2022
                """,
                run_id,
            )
            if not rows:
                raise HTTPException(status_code=404, detail="Run not found")
            return_run_id = str(run_id)
        else:
            # Latest run
            run = await conn.fetchrow(
                """
                SELECT id FROM public.clustering_runs
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            if not run:
                return {"run_id": None, "assignments": []}
            return_run_id = str(run["id"])
            rows = await conn.fetch(
                """
                SELECT stat_2022, cluster, cluster_label
                FROM public.cluster_assignments
                WHERE run_id = $1
                ORDER BY stat_2022
                """,
                run["id"],
            )

    assignments = [
        {"stat_2022": r["stat_2022"], "cluster": r["cluster"], "cluster_label": r["cluster_label"]}
        for r in rows
    ]
    return {"run_id": return_run_id, "assignments": assignments}


@router.get("/latest")
async def get_latest_run():
    """Get the latest clustering run summary (no assignments)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, k, silhouette_score, calinski_harabasz_score, davies_bouldin_score, created_at
            FROM public.clustering_runs
            ORDER BY created_at DESC
            LIMIT 1
            """
        )
    if not row:
        return {"run": None}
    return {
        "run": {
            "run_id": str(row["id"]),
            "k": row["k"],
            "silhouette_score": float(row["silhouette_score"]) if row["silhouette_score"] is not None else None,
            "calinski_harabasz_score": float(row["calinski_harabasz_score"]) if row["calinski_harabasz_score"] is not None else None,
            "davies_bouldin_score": float(row["davies_bouldin_score"]) if row["davies_bouldin_score"] is not None else None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
    }


@router.get("/full")
async def get_full_clustering(
    run_id: UUID | None = Query(None, description="Run ID; if omitted, latest run is used"),
):
    """
    Get assignments and profiles joined in a single response.
    Each area includes its full cluster profile embedded directly.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        if run_id is None:
            run = await conn.fetchrow(
                """
                SELECT id, k FROM public.clustering_runs
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            if not run:
                return {"run_id": None, "k": None, "profiles": [], "areas": []}
            run_id = run["id"]
            k = run["k"]
        else:
            run = await conn.fetchrow(
                "SELECT k FROM public.clustering_runs WHERE id = $1", run_id
            )
            if not run:
                raise HTTPException(status_code=404, detail="Run not found")
            k = run["k"]

        profiles_rows = await conn.fetch(
            """
            SELECT cluster, name, short_description, dimensions
            FROM public.cluster_profiles
            WHERE run_id = $1
            ORDER BY cluster
            """,
            run_id,
        )
        assignments_rows = await conn.fetch(
            """
            SELECT stat_2022, cluster, cluster_label
            FROM public.cluster_assignments
            WHERE run_id = $1
            ORDER BY stat_2022
            """,
            run_id,
        )

    # Build profile lookup by cluster id
    profile_map = {
        r["cluster"]: {
            "name": r["name"],
            "short_description": r["short_description"],
            "dimensions": r["dimensions"],
        }
        for r in profiles_rows
    }

    profiles = [
        {
            "cluster": r["cluster"],
            "name": r["name"],
            "short_description": r["short_description"],
            "dimensions": r["dimensions"],
        }
        for r in profiles_rows
    ]

    areas = [
        {
            "stat_2022": r["stat_2022"],
            "cluster": r["cluster"],
            "cluster_label": r["cluster_label"],
            "profile": profile_map.get(r["cluster"]),
        }
        for r in assignments_rows
    ]

    return {
        "run_id": str(run_id),
        "k": k,
        "profiles": profiles,
        "areas": areas,
    }
