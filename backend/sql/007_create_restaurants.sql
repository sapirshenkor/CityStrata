-- Create restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Restaurant identifier (using NUMERIC for very large numbers)
    cid NUMERIC NOT NULL UNIQUE,
    
    -- Business information
    title TEXT NOT NULL,
    description TEXT,
    category_name TEXT,
    
    -- Rating and status
    total_score DOUBLE PRECISION,
    temporarily_closed BOOLEAN DEFAULT FALSE,
    permanently_closed BOOLEAN DEFAULT FALSE,
    
    -- Contact and web presence
    url TEXT,
    website TEXT,
    street TEXT,
    
    -- Location information
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    
    -- Statistical area reference
    semel_yish INTEGER NOT NULL DEFAULT 2600,  -- Eilat code
    stat_2022 INTEGER NOT NULL,
    
    -- Operating hours (stored as JSONB for flexibility)
    activity_times JSONB,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_restaurant_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_location
    ON public.restaurants USING gist (location);

CREATE INDEX IF NOT EXISTS idx_restaurant_stat_area
    ON public.restaurants (stat_2022);

CREATE INDEX IF NOT EXISTS idx_restaurant_semel
    ON public.restaurants (semel_yish);

CREATE INDEX IF NOT EXISTS idx_restaurant_score
    ON public.restaurants (total_score);

CREATE INDEX IF NOT EXISTS idx_restaurant_category
    ON public.restaurants (category_name);

CREATE INDEX IF NOT EXISTS idx_restaurant_title
    ON public.restaurants (title);

CREATE INDEX IF NOT EXISTS idx_restaurant_status
    ON public.restaurants (temporarily_closed, permanently_closed);

CREATE INDEX IF NOT EXISTS idx_restaurant_cid
    ON public.restaurants (cid);

-- Add comment
COMMENT ON TABLE public.restaurants IS 'Restaurants in Eilat with statistical area assignments and operating information';