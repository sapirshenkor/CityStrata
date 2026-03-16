CREATE TABLE public.evacuee_family_profiles (
    -- System fields
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Part 1: Technical Details & Family Composition
    total_people INTEGER NOT NULL,
    infants INTEGER DEFAULT 0,
    preschool INTEGER DEFAULT 0,
    elementary INTEGER DEFAULT 0,
    youth INTEGER DEFAULT 0,
    adults INTEGER DEFAULT 0,
    seniors INTEGER DEFAULT 0,
    has_mobility_disability BOOLEAN DEFAULT FALSE,
    has_car BOOLEAN DEFAULT TRUE,

    -- Part 2: Educational Infrastructure
    -- Arrays in PostgreSQL are denoted with []
    essential_education TEXT[] DEFAULT '{}',
    education_proximity_importance INTEGER DEFAULT 3 CHECK (education_proximity_importance >= 1 AND education_proximity_importance <= 5),

    -- Part 3: Religious & Cultural Infrastructure
    religious_affiliation TEXT NOT NULL CHECK (religious_affiliation IN ('secular', 'traditional', 'religious', 'haredi', 'other')),
    needs_synagogue BOOLEAN DEFAULT FALSE,
    culture_frequency TEXT DEFAULT 'rarely' CHECK (culture_frequency IN ('daily', 'weekly', 'rarely')),

    -- Part 4: Community & Social Interaction
    matnas_participation BOOLEAN DEFAULT FALSE,
    social_venues_importance INTEGER DEFAULT 3 CHECK (social_venues_importance >= 1 AND social_venues_importance <= 5),
    needs_community_proximity BOOLEAN DEFAULT FALSE,

    -- Part 5: Housing & Accommodation Preferences
    accommodation_preference TEXT DEFAULT 'airbnb' CHECK (accommodation_preference IN ('airbnb', 'hotel')),
    estimated_stay_duration TEXT,

    -- Part 6: Urban Services
    needs_medical_proximity BOOLEAN DEFAULT FALSE,
    services_importance INTEGER DEFAULT 3 CHECK (services_importance >= 1 AND services_importance <= 5)
);

-- Optional: Add a comment to the table to describe its purpose
COMMENT ON TABLE public.evacuee_family_profiles IS 'Stores family profiles and needs for the CityStrata project matching system';