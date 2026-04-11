-- Age breakdown for community_profiles (aligned with evacuee_family_profiles composition)
ALTER TABLE public.community_profiles
    ADD COLUMN IF NOT EXISTS infants INTEGER NOT NULL DEFAULT 0 CHECK (infants >= 0),
    ADD COLUMN IF NOT EXISTS preschool INTEGER NOT NULL DEFAULT 0 CHECK (preschool >= 0),
    ADD COLUMN IF NOT EXISTS elementary INTEGER NOT NULL DEFAULT 0 CHECK (elementary >= 0),
    ADD COLUMN IF NOT EXISTS youth INTEGER NOT NULL DEFAULT 0 CHECK (youth >= 0),
    ADD COLUMN IF NOT EXISTS adults INTEGER NOT NULL DEFAULT 0 CHECK (adults >= 0),
    ADD COLUMN IF NOT EXISTS seniors INTEGER NOT NULL DEFAULT 0 CHECK (seniors >= 0);

-- Backfill: existing rows get all people in adults so sum matches total_people
UPDATE public.community_profiles
SET adults = total_people
WHERE infants + preschool + elementary + youth + adults + seniors = 0
  AND total_people > 0;

COMMENT ON COLUMN public.community_profiles.infants IS '0–1 age bucket count';
COMMENT ON COLUMN public.community_profiles.preschool IS '2–5 (gan) age bucket count';
COMMENT ON COLUMN public.community_profiles.elementary IS '6–12 age bucket count';
COMMENT ON COLUMN public.community_profiles.youth IS '13–18 age bucket count';
