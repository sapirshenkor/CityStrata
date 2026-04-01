-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0023: Multi-Family Profiles & Split Tactical Response Tables
--
-- Creates three new tables:
--   1. multi_family_profiles          — aggregated profiles for multi-family
--                                       relocations (mirrors evacuee_family_profiles)
--   2. family_tactical_responses      — tactical responses for individual families
--   3. multi_family_tactical_responses — tactical responses for multi-family groups
--
-- Prerequisites: migrations 014, 015, 016, 017, 0020, 0021, 0022
--                (set_updated_at() function must exist from migration 017)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── Table 1: multi_family_profiles ──────────────────────────────────────────
-- Structure mirrors evacuee_family_profiles with one addition:
--   member_family_uuids — tracks which original families compose this profile.

CREATE TABLE IF NOT EXISTS public.multi_family_profiles (
    id              SERIAL PRIMARY KEY,
    uuid            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Which original families compose this multi-family profile (sorted for idempotent lookup)
    member_family_uuids UUID[] NOT NULL,

    -- Contact & Location (inherited from first source family)
    family_name     TEXT NOT NULL,
    contact_name    TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    home_stat_2022  INTEGER,
    city_name       TEXT,
    home_address    TEXT,

    -- Family Composition (aggregated sums)
    total_people    INTEGER NOT NULL,
    infants         INTEGER DEFAULT 0,
    preschool       INTEGER DEFAULT 0,
    elementary      INTEGER DEFAULT 0,
    youth           INTEGER DEFAULT 0,
    adults          INTEGER DEFAULT 0,
    seniors         INTEGER DEFAULT 0,
    has_mobility_disability BOOLEAN DEFAULT FALSE,
    has_car         BOOLEAN DEFAULT TRUE,

    -- Educational Infrastructure
    essential_education TEXT[] DEFAULT '{}',
    education_proximity_importance INTEGER DEFAULT 3
        CHECK (education_proximity_importance >= 1 AND education_proximity_importance <= 5),

    -- Religious & Cultural Infrastructure
    religious_affiliation TEXT NOT NULL
        CHECK (religious_affiliation IN ('secular', 'traditional', 'religious', 'haredi', 'other')),
    needs_synagogue BOOLEAN DEFAULT FALSE,
    culture_frequency TEXT DEFAULT 'rarely'
        CHECK (culture_frequency IN ('daily', 'weekly', 'rarely')),

    -- Community & Social Interaction
    matnas_participation BOOLEAN DEFAULT FALSE,
    social_venues_importance INTEGER DEFAULT 3
        CHECK (social_venues_importance >= 1 AND social_venues_importance <= 5),
    needs_community_proximity BOOLEAN DEFAULT FALSE,

    -- Housing & Accommodation Preferences
    accommodation_preference TEXT DEFAULT 'airbnb'
        CHECK (accommodation_preference IN ('airbnb', 'hotel')),
    estimated_stay_duration TEXT,

    -- Urban Services
    needs_medical_proximity BOOLEAN DEFAULT FALSE,
    services_importance INTEGER DEFAULT 3
        CHECK (services_importance >= 1 AND services_importance <= 5),

    notes TEXT,

    -- Matching linkage (same FK pattern as evacuee_family_profiles)
    selected_matching_result_id UUID
        REFERENCES public.matching_results(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.multi_family_profiles IS
    'Aggregated profiles for multi-family relocations. Mirrors evacuee_family_profiles structure with member_family_uuids tracking source families.';

CREATE INDEX IF NOT EXISTS idx_multi_family_profiles_selected_matching_result_id
    ON public.multi_family_profiles (selected_matching_result_id);

-- Updated-at trigger (reuses the existing set_updated_at() function from migration 017)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_multi_family_profiles_updated_at'
    ) THEN
        CREATE TRIGGER trg_multi_family_profiles_updated_at
        BEFORE UPDATE ON public.multi_family_profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;


-- ─── Table 2: family_tactical_responses ──────────────────────────────────────
-- Stores tactical relocation responses for individual families.

CREATE TABLE IF NOT EXISTS public.family_tactical_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_uuid     UUID NOT NULL
                        REFERENCES public.evacuee_family_profiles(uuid) ON DELETE CASCADE,
    report_markdown TEXT NOT NULL,
    metadata_json   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.family_tactical_responses IS
    'Tactical relocation responses for individual families.';

CREATE INDEX IF NOT EXISTS idx_family_tactical_responses_family_uuid
    ON public.family_tactical_responses (family_uuid);


-- ─── Table 3: multi_family_tactical_responses ────────────────────────────────
-- Stores tactical relocation responses for multi-family groups.

CREATE TABLE IF NOT EXISTS public.multi_family_tactical_responses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    multi_family_uuid   UUID NOT NULL
                            REFERENCES public.multi_family_profiles(uuid) ON DELETE CASCADE,
    report_markdown     TEXT NOT NULL,
    metadata_json       JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.multi_family_tactical_responses IS
    'Tactical relocation responses for multi-family groups.';

CREATE INDEX IF NOT EXISTS idx_multi_family_tactical_responses_mf_uuid
    ON public.multi_family_tactical_responses (multi_family_uuid);
