-- Link an evacuee family profile to the selected (latest) matching result.
-- Nullable because the agent may not have run yet.
ALTER TABLE public.evacuee_family_profiles
    ADD COLUMN IF NOT EXISTS selected_matching_result_id UUID NULL
        REFERENCES public.matching_results (id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evacuee_family_profiles_selected_matching_result_id
    ON public.evacuee_family_profiles (selected_matching_result_id);

