-- Matching results: stores the output of the cluster matching agent per evacuee profile.
-- Keeps both a structured summary (columns) and the full agent output (JSONB).
CREATE TABLE IF NOT EXISTS public.matching_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Link to the source inputs used for matching
    profile_uuid UUID NOT NULL
        REFERENCES public.evacuee_family_profiles (uuid)
        ON DELETE CASCADE,
    run_id UUID NOT NULL
        REFERENCES public.clustering_runs (id)
        ON DELETE RESTRICT,

    -- Agent output (denormalized columns for easy querying)
    recommended_cluster_number INTEGER NOT NULL,
    recommended_cluster TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    reasoning TEXT NOT NULL,
    alternative_cluster_number INTEGER,
    alternative_cluster TEXT NOT NULL,
    alternative_reasoning TEXT NOT NULL,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Full raw agent output for forwards compatibility (same keys as the API response)
    agent_output JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matching_results_profile_uuid
    ON public.matching_results (profile_uuid);

CREATE INDEX IF NOT EXISTS idx_matching_results_run_id
    ON public.matching_results (run_id);

CREATE INDEX IF NOT EXISTS idx_matching_results_created_at
    ON public.matching_results (created_at DESC);

