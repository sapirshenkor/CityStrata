"""
Clustering pipeline: load PCA data from DB, run K-Means, persist assignments.
"""

import json
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import (
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)

# PC columns in pca_ready_for_clustering (same order as table, excluding stat_2022)
PC_COLUMNS = [
    "PC_EDUCATION_1",
    "PC_EDUCATION_2",
    "PC_TOURISM_1",
    "PC_TOURISM_2",
    "PC_TOURISM_3",
    "PC_FOOD_1",
    "PC_FOOD_2",
    "PC_COMMUNITY_1",
    "PC_OSM_INFRA_1",
    "PC_OSM_INFRA_2",
    "PC_OSM_INFRA_3",
    "PC_RELIGIOUS_1",
    "PC_RELIGIOUS_2",
]

# Semantic groups of PCs for profile summaries.
PC_GROUPS = {
    "education": ["PC_EDUCATION_1", "PC_EDUCATION_2"],
    "tourism": ["PC_TOURISM_1", "PC_TOURISM_2", "PC_TOURISM_3"],
    "food": ["PC_FOOD_1", "PC_FOOD_2"],
    "community": ["PC_COMMUNITY_1"],
    "osm_infra": ["PC_OSM_INFRA_1", "PC_OSM_INFRA_2", "PC_OSM_INFRA_3"],
    "religious": ["PC_RELIGIOUS_1", "PC_RELIGIOUS_2"],
}

CLUSTER_DESCRIPTIONS = {
    "Residential - Secular": (
        "Secular residential zone with moderate tourism infrastructure (Airbnb/hotels). "
        "Good education access. Suitable for secular families and individuals."
    ),
    "Residential - Religious/Family": (
        "Quiet residential zone with strong religious and community character. "
        "High education density, community centers present. Suitable for religious families."
    ),
    "Commercial Core": (
        "City commercial center with very high food, dining and infrastructure density. "
        "Mixed tourism presence. Suitable for individuals needing urban amenities."
    ),
    "Peripheral - Sparse": (
        "Peripheral zone with minimal services and low activity across all dimensions. "
        "Limited infrastructure and education access. Lower priority for family placement."
    ),
}

KMEANS_N_INIT = 50
KMEANS_RANDOM_STATE = 42


def _assign_semantic_label(profile: dict[str, str]) -> str:
    """
    Map a cluster's dimension profile to one of the fixed, domain-specific labels:

    - "Residential - Secular": Areas with Airbnb/hotel presence used as residential opportunity,
      secular character, low religious activity, moderate education.
    - "Residential - Religious/Family": Low tourism pressure, high religious character, high education,
      strong community presence, family oriented.
    - "Commercial Core": City commercial center with very high food/dining and infrastructure,
      mixed tourism, secular character, city center feel.
    - "Peripheral - Sparse": Peripheral areas with low scores across most dimensions,
      minimal services and infrastructure.
    """
    religious = profile.get("religious", "medium")
    tourism = profile.get("tourism", "medium")
    food = profile.get("food", "medium")
    osm_infra = profile.get("osm_infra", "medium")

    def is_high(level: str) -> bool:
        return level in {"high", "very_high"}

    def is_low(level: str) -> bool:
        return level in {"low", "very_low"}

    # 1. Residential - Religious/Family:
    #    If religious is high or very_high AND tourism is low or very_low.
    if is_high(religious) and is_low(tourism):
        return "Residential - Religious/Family"

    # 2. Commercial Core:
    #    If food is very_high OR osm_infra is very_high.
    if food == "very_high" or osm_infra == "very_high":
        return "Commercial Core"

    # 3. Residential - Secular:
    #    If tourism is high or very_high AND religious is low, very_low, or medium.
    if is_high(tourism) and religious in {"low", "very_low", "medium"}:
        return "Residential - Secular"

    # 4. Peripheral - Sparse:
    #    If most dimensions are low or very_low.
    low_count = sum(1 for level in profile.values() if is_low(level))
    if low_count >= max(1, len(profile) - 1):
        return "Peripheral - Sparse"

    # 5. Fallback:
    #    Default to "Residential - Secular" as the most common type in Eilat.
    return "Residential - Secular"


def _build_cluster_dimension_profile(
    X: np.ndarray, labels: np.ndarray
) -> dict[int, dict]:
    """
    Build a high/medium/low profile per semantic dimension for each cluster,
    comparing clusters *against each other* (relative profiles), not just to
    the global mean. This makes differences between clusters more meaningful.
    """
    column_index = {name: idx for idx, name in enumerate(PC_COLUMNS)}

    # First pass: compute per-cluster, per-group raw means.
    cluster_ids = np.unique(labels)
    group_values: dict[int, dict[str, float]] = {}
    for cluster_id in cluster_ids:
        mask = labels == cluster_id
        cluster_X = X[mask]
        cluster_means = cluster_X.mean(axis=0)

        values_for_cluster: dict[str, float] = {}
        for group_name, pc_names in PC_GROUPS.items():
            indices = [column_index[name] for name in pc_names]
            values_for_cluster[group_name] = float(cluster_means[indices].mean())
        group_values[int(cluster_id)] = values_for_cluster

    # Second pass: for each group, compute mean/std across clusters and turn
    # each cluster's value into a z-score; then bucket into levels.
    def categorize_z(z: float) -> str:
        if z >= 1.0:
            return "very_high"
        if z >= 0.5:
            return "high"
        if z <= -1.0:
            return "very_low"
        if z <= -0.5:
            return "low"
        return "medium"

    profiles: dict[int, dict] = {int(cid): {} for cid in cluster_ids}
    for group_name in PC_GROUPS.keys():
        vals = np.array(
            [group_values[int(cid)][group_name] for cid in cluster_ids], dtype=float
        )
        mean = float(vals.mean())
        std = float(vals.std())

        # If almost no variation, mark all as medium.
        if std < 1e-6:
            for cid in cluster_ids:
                profiles[int(cid)][group_name] = "medium"
            continue

        z_scores = (vals - mean) / std
        for cid, z in zip(cluster_ids, z_scores):
            profiles[int(cid)][group_name] = categorize_z(float(z))

    return profiles


async def run_clustering_pipeline(conn, k: int = 4) -> dict:
    """
    Load PCA data from DB, run K-Means, persist to clustering_runs and cluster_assignments.
    Returns run summary and assignments.
    """
    # Duplicate run protection: reuse latest run with same k from last 24 hours.
    existing = await conn.fetchrow(
        """
        SELECT id
        FROM public.clustering_runs
        WHERE k = $1
          AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        k,
    )
    if existing:
        run_id = existing["id"]

        run_row = await conn.fetchrow(
            """
            SELECT k, silhouette_score, calinski_harabasz_score, davies_bouldin_score
            FROM public.clustering_runs
            WHERE id = $1
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
        profiles_rows = await conn.fetch(
            """
            SELECT cluster, name, short_description, dimensions
            FROM public.cluster_profiles
            WHERE run_id = $1
            ORDER BY cluster
            """,
            run_id,
        )

        assignments = [
            {
                "stat_2022": r["stat_2022"],
                "cluster": r["cluster"],
                "cluster_label": r["cluster_label"],
            }
            for r in assignments_rows
        ]
        cluster_profiles = [
            {
                "cluster": r["cluster"],
                "name": r["name"],
                "short_description": r["short_description"],
                "dimensions": r["dimensions"],
            }
            for r in profiles_rows
        ]

        return {
            "run_id": str(run_id),
            "k": run_row["k"],
            "silhouette_score": float(run_row["silhouette_score"])
            if run_row["silhouette_score"] is not None
            else None,
            "calinski_harabasz_score": float(run_row["calinski_harabasz_score"])
            if run_row["calinski_harabasz_score"] is not None
            else None,
            "davies_bouldin_score": float(run_row["davies_bouldin_score"])
            if run_row["davies_bouldin_score"] is not None
            else None,
            "n_areas": len(assignments),
            "assignments": assignments,
            "cluster_profiles": cluster_profiles,
            "from_cache": True,
        }

    # Phase 1: load from pca_ready_for_clustering and compute clustering/profiles/metrics
    rows = await conn.fetch(
        """
        SELECT stat_2022, """
        + ", ".join(PC_COLUMNS)
        + """
        FROM public.pca_ready_for_clustering
        ORDER BY stat_2022
        """
    )
    if not rows:
        raise ValueError("No rows in pca_ready_for_clustering")

    stat_2022_list = [r["stat_2022"] for r in rows]
    # PostgreSQL returns column names lowercase; use lowercase for row access
    pc_cols_lower = [c.lower() for c in PC_COLUMNS]
    X = np.array([[r[col] for col in pc_cols_lower] for r in rows], dtype=np.float64)

    # K-Means
    km = KMeans(n_clusters=k, n_init=KMEANS_N_INIT, random_state=KMEANS_RANDOM_STATE)
    labels = km.fit_predict(X)

    # Re-label by cluster size (largest = 0) for consistency with notebook
    unique, counts = np.unique(labels, return_counts=True)
    size_order = unique[np.argsort(-counts)]
    remap = {old: new for new, old in enumerate(size_order)}
    labels = np.array([remap[l] for l in labels])

    # Build per-cluster semantic profiles (based on relabelled clusters)
    dimension_profiles = _build_cluster_dimension_profile(X, labels)

    # Map cluster -> semantic label once, reuse for assignments and profiles.
    semantic_labels = {
        int(cluster): _assign_semantic_label(profile)
        for cluster, profile in dimension_profiles.items()
    }

    # Metrics
    sil = float(silhouette_score(X, labels))
    ch = float(calinski_harabasz_score(X, labels))
    db = float(davies_bouldin_score(X, labels))

    # Phase 2: persist in a single transaction (run + assignments + profiles)
    async with conn.transaction():
        run_id = await conn.fetchval(
            """
            INSERT INTO public.clustering_runs (k, silhouette_score, calinski_harabasz_score, davies_bouldin_score)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            k,
            sil,
            ch,
            db,
        )

        # Persist assignments with semantic labels as cluster_label
        for stat_2022, cluster in zip(stat_2022_list, labels.tolist()):
            await conn.execute(
                """
                INSERT INTO public.cluster_assignments (run_id, stat_2022, cluster, cluster_label)
                VALUES ($1, $2, $3, $4)
                """,
                run_id,
                stat_2022,
                cluster,
                semantic_labels[int(cluster)],
            )

        # Persist initial cluster profiles with semantic labels and rich descriptions.
        for cluster, profile in dimension_profiles.items():
            label = semantic_labels[int(cluster)]
            short_description = CLUSTER_DESCRIPTIONS.get(
                label,
                CLUSTER_DESCRIPTIONS["Residential - Secular"],
            )

            await conn.execute(
                """
                INSERT INTO public.cluster_profiles (run_id, cluster, name, short_description, dimensions)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (run_id, cluster) DO UPDATE
                SET
                    name = EXCLUDED.name,
                    short_description = EXCLUDED.short_description,
                    dimensions = EXCLUDED.dimensions,
                    updated_at = NOW()
                """,
                run_id,
                cluster,
                label,
                short_description,
                json.dumps(profile),
            )

    assignments = [
        {
            "stat_2022": s,
            "cluster": c,
            "cluster_label": semantic_labels[int(c)],
        }
        for s, c in zip(stat_2022_list, labels.tolist())
    ]

    return {
        "run_id": str(run_id),
        "k": k,
        "silhouette_score": round(sil, 4),
        "calinski_harabasz_score": round(ch, 2),
        "davies_bouldin_score": round(db, 4),
        "n_areas": len(stat_2022_list),
        "assignments": assignments,
        "cluster_profiles": [
            {
                "cluster": c,
                "name": semantic_labels[int(c)],
                "short_description": CLUSTER_DESCRIPTIONS.get(
                    semantic_labels[int(c)],
                    CLUSTER_DESCRIPTIONS["Residential - Secular"],
                ),
                "dimensions": dimension_profiles[c],
            }
            for c in sorted(dimension_profiles.keys())
        ],
    }
