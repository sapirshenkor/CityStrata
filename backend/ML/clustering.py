"""
Clustering pipeline: load PCA data from DB, run K-Means, persist assignments.
"""

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

KMEANS_N_INIT = 50
KMEANS_RANDOM_STATE = 42


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
    }
