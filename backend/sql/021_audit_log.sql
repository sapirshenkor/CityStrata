-- Audit trail for municipality user actions.
-- Run after public.municipality_users exists.

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.municipality_users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS 'Append-only audit events; prefer inserts from trusted backend (service role)';

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

