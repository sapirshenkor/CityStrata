-- Cluster profiles: human-meaningful metadata per (run, cluster).
-- Stores names, descriptions and a structured dimensions profile for agents and UIs.
CREATE TABLE IF NOT EXISTS public.cluster_profiles (
    run_id UUID NOT NULL REFERENCES public.clustering_runs (id) ON DELETE CASCADE,
    cluster INTEGER NOT NULL,

    -- Short, human-readable name, e.g. "Tourism & Food Hubs"
    name TEXT NOT NULL,

    -- 1–3 sentence description of what characterizes this cluster.
    short_description TEXT NOT NULL,

    -- JSONB with a structured profile, e.g.
    -- { "education": "low", "tourism": "very_high", "food": "high", ... }
    dimensions JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (run_id, cluster)
);

CREATE INDEX IF NOT EXISTS idx_cluster_profiles_run_id
    ON public.cluster_profiles (run_id);

