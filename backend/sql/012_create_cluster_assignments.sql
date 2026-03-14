-- Clustering runs: one row per pipeline execution (e.g. "latest run").
CREATE TABLE IF NOT EXISTS public.clustering_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    k INTEGER NOT NULL,
    silhouette_score DOUBLE PRECISION NULL,
    calinski_harabasz_score DOUBLE PRECISION NULL,
    davies_bouldin_score DOUBLE PRECISION NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clustering_runs_created_at
    ON public.clustering_runs (created_at DESC);

-- Cluster assignments: one row per (run, stat_2022). Links statistical areas to clusters.
CREATE TABLE IF NOT EXISTS public.cluster_assignments (
    run_id UUID NOT NULL REFERENCES public.clustering_runs (id) ON DELETE CASCADE,
    stat_2022 INTEGER NOT NULL,
    cluster INTEGER NOT NULL,
    cluster_label TEXT NOT NULL,
    PRIMARY KEY (run_id, stat_2022)
);

CREATE INDEX IF NOT EXISTS idx_cluster_assignments_run_id
    ON public.cluster_assignments (run_id);

CREATE INDEX IF NOT EXISTS idx_cluster_assignments_stat_2022
    ON public.cluster_assignments (stat_2022);
