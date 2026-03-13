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

# Human-readable labels for semantic groups, used in auto-generated cluster names.
PC_GROUP_TITLES = {
    "education": "education",
    "tourism": "tourism",
    "food": "food & dining",
    "community": "community services",
    "osm_infra": "general infrastructure",
    "religious": "religious facilities",
}

KMEANS_N_INIT = 50
KMEANS_RANDOM_STATE = 42


def _auto_cluster_name(cluster_id: int, profile: dict[str, str]) -> str:
    """
    Derive a short, human-friendly name from a dimension profile.
    Focuses on the strongest 'high' / 'very_high' dimensions.
    """
    importance = {
        "very_high": 2,
        "high": 1,
        "medium": 0,
        "low": -1,
        "very_low": -2,
    }

    scored = []
    for dim, level in profile.items():
        score = importance.get(level, 0)
        scored.append((dim, level, score))

    # Sort by score (descending), then by dimension name for stability.
    scored.sort(key=lambda x: (-x[2], x[0]))

    # Take dimensions that are at least "high".
    top_dims = [s for s in scored if s[2] >= 1]
    if not top_dims:
        # If nothing clearly stands out, call it a balanced cluster.
        return f"Balanced cluster {cluster_id}"

    # If religious dimension is high/very_high, force it into the name.
    religious_entry = next((s for s in top_dims if s[0] == "religious"), None)

    if religious_entry is not None:
        # Prefer to highlight religious facilities explicitly.
        # Optionally combine with the strongest non-religious dimension.
        non_religious = [s for s in top_dims if s[0] != "religious"]
        if not non_religious:
            return "Religious facilities cluster"

        non_religious.sort(key=lambda x: (-x[2], x[0]))
        main_dim, _, _ = non_religious[0]
        main_title = PC_GROUP_TITLES.get(main_dim, main_dim.replace("_", " "))
        return f"{main_title.title()} & Religious facilities cluster"

    # No high religious dimension: use the strongest one or two dimensions.
    # Use at most the top two.
    top_dims = top_dims[:2]
    titles = [PC_GROUP_TITLES.get(dim, dim.replace("_", " ")) for dim, _, _ in top_dims]

    if len(titles) == 1:
        main = titles[0]
        return f"High-{main} cluster"

    first, second = titles
    return f"{first.title()} & {second.title()} cluster"


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
    # Load from pca_ready_for_clustering
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

    # Metrics
    sil = float(silhouette_score(X, labels))
    ch = float(calinski_harabasz_score(X, labels))
    db = float(davies_bouldin_score(X, labels))

    # Persist run
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

    # Persist assignments
    for stat_2022, cluster in zip(stat_2022_list, labels.tolist()):
        await conn.execute(
            """
            INSERT INTO public.cluster_assignments (run_id, stat_2022, cluster, cluster_label)
            VALUES ($1, $2, $3, $4)
            """,
            run_id,
            stat_2022,
            cluster,
            f"Cluster_{cluster}",
        )

    # Persist initial cluster profiles with simple, structured summaries.
    for cluster, profile in dimension_profiles.items():
        high_dims = [
            name for name, level in profile.items() if level in {"high", "very_high"}
        ]
        low_dims = [
            name for name, level in profile.items() if level in {"low", "very_low"}
        ]

        parts: list[str] = []
        if high_dims:
            parts.append("High in " + ", ".join(high_dims))
        if low_dims:
            parts.append("Low in " + ", ".join(low_dims))
        if not parts:
            parts.append("Balanced across dimensions")
        short_description = ". ".join(parts)
        name = _auto_cluster_name(cluster, profile)

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
            name,
            short_description,
            json.dumps(profile),
        )

    assignments = [
        {"stat_2022": s, "cluster": c, "cluster_label": f"Cluster_{c}"}
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
                "name": _auto_cluster_name(c, dimension_profiles[c]),
                "dimensions": dimension_profiles[c],
            }
            for c in sorted(dimension_profiles.keys())
        ],
    }
