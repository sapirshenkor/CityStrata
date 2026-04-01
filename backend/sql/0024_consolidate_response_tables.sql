-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0024: Consolidate to 4-Table Architecture
--
-- Final schema:
--   1. evacuee_family_profiles          (existing, unchanged)
--   2. multi_family_profiles            (existing from 0023, unchanged)
--   3. family_tactical_responses        (DROP + recreate with detailed schema)
--   4. multi_family_tactical_responses  (DROP + recreate with detailed schema)
--
-- This migration:
--   a) Migrates data from the old tactical_agent_response → new family_tactical_responses
--   b) Drops the back-reference column on evacuee_family_profiles
--   c) Drops the old tactical_agent_response table
--   d) Drops the old simple response tables from migration 0023
--   e) Creates the new response tables with detailed columns + upsert support
--
-- Prerequisites: migrations 0020-0023 applied; set_updated_at() exists (017).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Preserve existing data ──────────────────────────────────────────────

CREATE TEMP TABLE _tar_backup AS
SELECT profile_uuid, confidence, agent_output, radii_data, created_at,
       COALESCE(updated_at, created_at) AS updated_at
FROM tactical_agent_response;


-- ─── 2. Drop FK column from evacuee_family_profiles ─────────────────────────

ALTER TABLE evacuee_family_profiles
    DROP COLUMN IF EXISTS tactical_agent_response_id;


-- ─── 3. Drop old tables ─────────────────────────────────────────────────────

DROP TABLE IF EXISTS family_tactical_responses;
DROP TABLE IF EXISTS multi_family_tactical_responses;
DROP TABLE IF EXISTS tactical_agent_response;


-- ─── 4. Create family_tactical_responses (detailed schema) ──────────────────

CREATE TABLE public.family_tactical_responses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    profile_uuid    UUID        NOT NULL    UNIQUE
                        REFERENCES public.evacuee_family_profiles(uuid) ON DELETE CASCADE,
    confidence      TEXT,
    agent_output    TEXT        NOT NULL,
    radii_data      JSONB
);

COMMENT ON TABLE public.family_tactical_responses IS
    'Tactical relocation responses for individual families. One row per profile (upsert).';

CREATE INDEX IF NOT EXISTS idx_family_tactical_responses_profile_uuid
    ON public.family_tactical_responses (profile_uuid);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_family_tactical_responses_updated_at'
    ) THEN
        CREATE TRIGGER trg_family_tactical_responses_updated_at
        BEFORE UPDATE ON public.family_tactical_responses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;


-- ─── 5. Create multi_family_tactical_responses (detailed schema) ────────────

CREATE TABLE public.multi_family_tactical_responses (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    multi_family_uuid   UUID        NOT NULL    UNIQUE
                            REFERENCES public.multi_family_profiles(uuid) ON DELETE CASCADE,
    confidence          TEXT,
    agent_output        TEXT        NOT NULL,
    radii_data          JSONB
);

COMMENT ON TABLE public.multi_family_tactical_responses IS
    'Tactical relocation responses for multi-family groups. One row per profile (upsert).';

CREATE INDEX IF NOT EXISTS idx_multi_family_tactical_responses_mf_uuid
    ON public.multi_family_tactical_responses (multi_family_uuid);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_multi_family_tactical_responses_updated_at'
    ) THEN
        CREATE TRIGGER trg_multi_family_tactical_responses_updated_at
        BEFORE UPDATE ON public.multi_family_tactical_responses
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;


-- ─── 6. Restore data from backup ───────────────────────────────────────────

INSERT INTO family_tactical_responses
    (profile_uuid, confidence, agent_output, radii_data, created_at, updated_at)
SELECT profile_uuid, confidence, agent_output, radii_data, created_at, updated_at
FROM _tar_backup
ON CONFLICT (profile_uuid) DO NOTHING;

DROP TABLE _tar_backup;
