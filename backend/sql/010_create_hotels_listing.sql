-- Create Hotels listings table
CREATE TABLE IF NOT EXISTS public.hotels_listings (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- hotels listing identifier
    hotelid BIGINT NOT NULL UNIQUE,  -- hotelid column
    
    -- Listing information
    url TEXT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    
    
    -- Rating 
    rating_value DOUBLE PRECISION,  -- rating column
    
    -- Location information
    location_fulladdress TEXT,  -- address/full column
    coordinates_latitude DOUBLE PRECISION NOT NULL,  -- location/lat
    coordinates_longitude DOUBLE PRECISION NOT NULL,  -- location/lng
    location GEOMETRY(Point, 4326) NOT NULL,
    
    -- Statistical area reference
    semel_yish INTEGER NOT NULL DEFAULT 2600,  -- Eilat code
    stat_2022 INTEGER NOT NULL,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_hotels_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hotels_location
    ON public.hotels_listings USING gist (location);

CREATE INDEX IF NOT EXISTS idx_hotels_stat_area
    ON public.hotels_listings (stat_2022);

CREATE INDEX IF NOT EXISTS idx_hotels_semel
    ON public.hotels_listings (semel_yish);

CREATE INDEX IF NOT EXISTS idx_hotels_rating
    ON public.hotels_listings (rating_value);

CREATE INDEX IF NOT EXISTS idx_hotels_type
    ON public.hotels_listings (type);

-- Add comment
COMMENT ON TABLE public.hotels_listings IS 'hotels listings in Eilat with statistical area assignments';