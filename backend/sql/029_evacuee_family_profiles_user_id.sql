-- Phase A: nullable ownership for family portal (additive; safe for existing rows)
ALTER TABLE public.evacuee_family_profiles
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.municipality_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evacuee_family_profiles_user_id
    ON public.evacuee_family_profiles (user_id);

COMMENT ON COLUMN public.evacuee_family_profiles.user_id IS
    'Owning municipality_users.id when profile was created via /api/family/me/*; NULL for legacy/unscoped rows.';
