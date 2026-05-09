-- Add nullable owner reference to multi_family_profiles (mirrors migration 029
-- on evacuee_family_profiles). Multi-family profiles are aggregated from one
-- or more evacuee_family_profiles; the owning user is inherited from the
-- source families when they all belong to the same user.
ALTER TABLE public.multi_family_profiles
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.municipality_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_multi_family_profiles_user_id
    ON public.multi_family_profiles (user_id);

COMMENT ON COLUMN public.multi_family_profiles.user_id IS
    'Owning municipality_users.id, inherited from the source evacuee_family_profiles when they all share the same owner; NULL when sources span multiple users or are legacy/unscoped rows.';
