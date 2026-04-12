-- Community profiles: collective evacuee groups (neighborhood, kibbutz, religious community, etc.)
CREATE TABLE IF NOT EXISTS public.community_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT NOT NULL,

    total_families INTEGER NOT NULL DEFAULT 1 CHECK (total_families >= 0),
    total_people INTEGER NOT NULL CHECK (total_people > 0),

    infants INTEGER NOT NULL DEFAULT 0 CHECK (infants >= 0),
    preschool INTEGER NOT NULL DEFAULT 0 CHECK (preschool >= 0),
    elementary INTEGER NOT NULL DEFAULT 0 CHECK (elementary >= 0),
    youth INTEGER NOT NULL DEFAULT 0 CHECK (youth >= 0),
    adults INTEGER NOT NULL DEFAULT 0 CHECK (adults >= 0),
    seniors INTEGER NOT NULL DEFAULT 0 CHECK (seniors >= 0),

    community_type TEXT NOT NULL CHECK (
        community_type IN (
            'neighborhood',
            'religious',
            'kibbutz_moshav',
            'interest_group'
        )
    ),

    cohesion_importance INTEGER NOT NULL DEFAULT 3 CHECK (
        cohesion_importance >= 1 AND cohesion_importance <= 5
    ),

    housing_preference TEXT NOT NULL CHECK (
        housing_preference IN ('hotel', 'scattered_apartments')
    ),

    needs_synagogue BOOLEAN NOT NULL DEFAULT FALSE,
    needs_community_center BOOLEAN NOT NULL DEFAULT FALSE,
    needs_education_institution BOOLEAN NOT NULL DEFAULT FALSE,

    infrastructure_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_profiles_created_at
    ON public.community_profiles (created_at DESC);

COMMENT ON TABLE public.community_profiles IS 'Collective community / group profiles for CityStrata (complements evacuee_family_profiles)';
