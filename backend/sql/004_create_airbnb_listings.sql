-- Create Airbnb listings table
CREATE TABLE IF NOT EXISTS public.airbnb_listings (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Airbnb listing identifier
    id BIGINT NOT NULL UNIQUE,
    
    -- Listing information
    url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Pricing information
    price_qualifier TEXT,  -- price/qualifier column (e.g., "for 5 nights")
    price_numeric INTEGER,
    num_nights INTEGER,
    price_per_night DOUBLE PRECISION,
    
    -- Rating and capacity
    rating_value DOUBLE PRECISION,  -- rating/value column
    person_capacity INTEGER,  -- personCapacity column
    
    -- Location information
    location_subtitle TEXT,  -- locationSubtitle column
    coordinates_latitude DOUBLE PRECISION NOT NULL,  -- coordinates/latitude
    coordinates_longitude DOUBLE PRECISION NOT NULL,  -- coordinates/longitude
    location GEOMETRY(Point, 4326) NOT NULL,
    
    -- Statistical area reference
    semel_yish INTEGER NOT NULL DEFAULT 2600,  -- Eilat code
    stat_2022 INTEGER NOT NULL,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_airbnb_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_airbnb_location
    ON public.airbnb_listings USING gist (location);

CREATE INDEX IF NOT EXISTS idx_airbnb_stat_area
    ON public.airbnb_listings (stat_2022);

CREATE INDEX IF NOT EXISTS idx_airbnb_semel
    ON public.airbnb_listings (semel_yish);

CREATE INDEX IF NOT EXISTS idx_airbnb_price
    ON public.airbnb_listings (price_per_night);

CREATE INDEX IF NOT EXISTS idx_airbnb_rating
    ON public.airbnb_listings (rating_value);

CREATE INDEX IF NOT EXISTS idx_airbnb_capacity
    ON public.airbnb_listings (person_capacity);

-- Add comment
COMMENT ON TABLE public.airbnb_listings IS 'Airbnb listings in Eilat with statistical area assignments and pricing information';