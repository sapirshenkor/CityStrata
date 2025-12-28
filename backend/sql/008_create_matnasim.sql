-- 1. Create the matnasim table
CREATE TABLE IF NOT EXISTS public.matnasim (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Business/Center information
    matnas_name TEXT NOT NULL UNIQUE,
    full_address TEXT,
    person_in_charge TEXT,
    phone_number TEXT,
    activity_days TEXT,
    
    -- Facility details
    facility_area INTEGER,
    occupancy INTEGER,
    number_of_activity_rooms TEXT,
    shelter_and_where TEXT,
    
    -- Location information
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    
    -- Statistical area reference (Foreign Keys)
    semel_yish INTEGER NOT NULL DEFAULT 2600,  -- Default to Eilat
    stat_2022 INTEGER NOT NULL,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint (matching your coffee shops example)
    CONSTRAINT fk_matnas_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 2. Create indexes for performance
-- Spatial index for map queries
CREATE INDEX IF NOT EXISTS idx_matnas_location
    ON public.matnasim USING gist (location);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_matnas_stat_area
    ON public.matnasim (stat_2022);

CREATE INDEX IF NOT EXISTS idx_matnas_semel
    ON public.matnasim (semel_yish);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_matnas_name
    ON public.matnasim (matnas_name);

-- 3. Add comment to table
COMMENT ON TABLE public.matnasim IS 'Community centers (Matnasim) in Eilat with statistical area assignments and facility data';