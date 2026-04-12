-- Macro cluster matching for collective community_profiles (parallel to matching_results for families)
CREATE TABLE IF NOT EXISTS public.community_matching_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    community_profile_id UUID NOT NULL
        REFERENCES public.community_profiles (id)
        ON DELETE CASCADE,
    run_id UUID NOT NULL
        REFERENCES public.clustering_runs (id)
        ON DELETE RESTRICT,

    recommended_cluster_number INTEGER NOT NULL,
    recommended_cluster TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    reasoning TEXT NOT NULL,
    alternative_cluster_number INTEGER,
    alternative_cluster TEXT NOT NULL,
    alternative_reasoning TEXT NOT NULL,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    agent_output JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_matching_results_community_profile_id
    ON public.community_matching_results (community_profile_id);

CREATE INDEX IF NOT EXISTS idx_community_matching_results_run_id
    ON public.community_matching_results (run_id);

CREATE INDEX IF NOT EXISTS idx_community_matching_results_created_at
    ON public.community_matching_results (created_at DESC);

COMMENT ON TABLE public.community_matching_results IS 'OpenAI macro cluster choice for community_profiles (parallel to matching_results)';

-- Link latest selected row (same pattern as evacuee_family_profiles)
ALTER TABLE public.community_profiles
    ADD COLUMN IF NOT EXISTS selected_matching_result_id UUID
        REFERENCES public.community_matching_results (id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_profiles_selected_matching_result_id
    ON public.community_profiles (selected_matching_result_id);
