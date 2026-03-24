-- Municipality admin users linked to Supabase Auth.
-- Run in Supabase SQL Editor (or via migration) after auth is enabled.

CREATE TABLE IF NOT EXISTS public.municipality_users (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    semel_yish INTEGER DEFAULT 2600,
    department TEXT,
    role TEXT DEFAULT 'editor',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.municipality_users IS 'Profile rows for municipality admins; id matches auth.users.id';



ALTER TABLE public.municipality_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY municipality_users_select_own
    ON public.municipality_users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

