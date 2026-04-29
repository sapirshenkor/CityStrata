-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Types
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'property_type_enum'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.property_type_enum AS ENUM ('apartment', 'garden_apt', 'private_house', 'building', 'other');
    END IF;
END $$;

-- 3. Master Table
CREATE TABLE IF NOT EXISTS public.property_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_user_id UUID NOT NULL REFERENCES public.municipality_users (id) ON DELETE CASCADE,
    property_type public.property_type_enum NOT NULL,
    property_type_other TEXT,
    city TEXT NOT NULL,
    street TEXT NOT NULL,
    neighborhood TEXT,
    house_number TEXT NOT NULL,
    total_floors INTEGER CHECK (total_floors > 0),
    parking_spots INTEGER NOT NULL DEFAULT 0 CHECK (parking_spots >= 0),
    location GEOMETRY(Point, 4326) NOT NULL,
    publisher_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_property_type_other_usage CHECK (
        (property_type = 'other' AND property_type_other IS NOT NULL AND btrim(property_type_other) <> '')
        OR
        (property_type <> 'other' AND property_type_other IS NULL)
    )
);

-- 4. Units Table
CREATE TABLE IF NOT EXISTS public.property_listing_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.property_listings (id) ON DELETE CASCADE,
    floor INTEGER,
    rooms NUMERIC(3, 1) NOT NULL CHECK (rooms > 0),
    bathrooms INTEGER NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
    -- Booleans Features
    has_accessibility BOOLEAN NOT NULL DEFAULT FALSE,
    has_ac BOOLEAN NOT NULL DEFAULT FALSE,
    has_bars BOOLEAN NOT NULL DEFAULT FALSE,
    has_solar_heater BOOLEAN NOT NULL DEFAULT FALSE,
    has_elevator BOOLEAN NOT NULL DEFAULT FALSE,
    is_for_roommates BOOLEAN NOT NULL DEFAULT FALSE,
    is_furnished BOOLEAN NOT NULL DEFAULT FALSE,
    is_unit BOOLEAN NOT NULL DEFAULT FALSE,
    is_kosher_kitchen BOOLEAN NOT NULL DEFAULT FALSE,
    allows_pets BOOLEAN NOT NULL DEFAULT FALSE,
    is_renovated BOOLEAN NOT NULL DEFAULT FALSE,
    has_mamad BOOLEAN NOT NULL DEFAULT FALSE,
    has_mamak BOOLEAN NOT NULL DEFAULT FALSE,
    has_building_shelter BOOLEAN NOT NULL DEFAULT FALSE,
    has_storage BOOLEAN NOT NULL DEFAULT FALSE,
    -- Pricing & Details
    built_sqm NUMERIC(10, 2) CHECK (built_sqm >= 0),
    monthly_price NUMERIC(12, 2) CHECK (monthly_price >= 0),
    rental_period TEXT,
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_property_listings_municipality_user_id ON public.property_listings (municipality_user_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_property_type ON public.property_listings (property_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_city ON public.property_listings (city);
CREATE INDEX IF NOT EXISTS idx_property_listings_city_property_type ON public.property_listings (city, property_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_location_gist ON public.property_listings USING gist (location);
CREATE INDEX IF NOT EXISTS idx_property_listing_units_listing_id ON public.property_listing_units (listing_id);
CREATE INDEX IF NOT EXISTS idx_property_listing_units_is_occupied ON public.property_listing_units (is_occupied);

-- 6. Documentation
COMMENT ON TABLE public.property_listings IS 'Master property listing posts with location and publisher details.';
COMMENT ON TABLE public.property_listing_units IS 'Units attached to a listing; supports multi-unit buildings and single-unit properties.';