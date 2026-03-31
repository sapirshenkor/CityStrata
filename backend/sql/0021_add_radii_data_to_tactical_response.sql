-- Add structured radii data (hub coordinates, radii, scores) for map rendering.
-- Stored as JSONB so the frontend can parse it without a separate join.
ALTER TABLE tactical_agent_response
    ADD COLUMN IF NOT EXISTS radii_data JSONB;
