-- 1. New table to store tactical reports
CREATE TABLE tactical_agent_response (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    profile_uuid  UUID        NOT NULL
                      REFERENCES evacuee_family_profiles(uuid) ON DELETE CASCADE,
    confidence    TEXT,
    agent_output  TEXT        NOT NULL
);

-- 2. Back-reference on the family profile
ALTER TABLE evacuee_family_profiles
    ADD COLUMN tactical_agent_response_id UUID
        REFERENCES tactical_agent_response(id) ON DELETE SET NULL;