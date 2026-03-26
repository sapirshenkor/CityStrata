-- Migration 0022: enable upsert behaviour for tactical_agent_response
--
-- 1. Add updated_at timestamp so the frontend knows when a report was last
--    refreshed (as opposed to created_at which is frozen after first insert).
-- 2. Add UNIQUE constraint on profile_uuid — required for
--    ON CONFLICT (profile_uuid) DO UPDATE in the agent's upsert logic.
--    A family has exactly one active tactical report; re-running the agent
--    now updates the existing row instead of creating a duplicate.

ALTER TABLE tactical_agent_response
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill updated_at to match created_at for existing rows.
UPDATE tactical_agent_response
SET    updated_at = created_at
WHERE  updated_at = NOW();          -- only rows just defaulted (i.e. pre-existing)

-- Remove any duplicate profile_uuid rows before adding the constraint.
-- Keeps the most-recently-created row per family and deletes the rest.
DELETE FROM tactical_agent_response
WHERE id NOT IN (
    SELECT DISTINCT ON (profile_uuid) id
    FROM   tactical_agent_response
    ORDER  BY profile_uuid, created_at DESC
);

-- Drop the old back-reference on evacuee_family_profiles rows that pointed
-- to now-deleted duplicates (they will be repointed by the upsert on next run).
UPDATE evacuee_family_profiles efp
SET    tactical_agent_response_id = NULL
WHERE  tactical_agent_response_id IS NOT NULL
  AND  NOT EXISTS (
      SELECT 1 FROM tactical_agent_response tar
      WHERE  tar.id = efp.tactical_agent_response_id
  );

-- Add the UNIQUE constraint. IF NOT EXISTS is not valid for ADD CONSTRAINT,
-- so we guard with a DO block to make the migration re-runnable.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE  conrelid = 'tactical_agent_response'::regclass
          AND  conname  = 'uq_tactical_agent_response_profile'
    ) THEN
        ALTER TABLE tactical_agent_response
            ADD CONSTRAINT uq_tactical_agent_response_profile
            UNIQUE (profile_uuid);
    END IF;
END;
$$;
