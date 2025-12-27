-- Create coffee shops table
CREATE TABLE IF NOT EXISTS public.coffee_shops (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Coffee shop identifier
    cid BIGINT NOT NULL UNIQUE,
    
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
    CONSTRAINT fk_coffee_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coffee_location
    ON public.coffee_shops USING gist (location);

CREATE INDEX IF NOT EXISTS idx_coffee_stat_area
    ON public.coffee_shops (stat_2022);

CREATE INDEX IF NOT EXISTS idx_coffee_semel
    ON public.coffee_shops (semel_yish);

CREATE INDEX IF NOT EXISTS idx_coffee_score
    ON public.coffee_shops (total_score);

CREATE INDEX IF NOT EXISTS idx_coffee_category
    ON public.coffee_shops (category_name);

CREATE INDEX IF NOT EXISTS idx_coffee_title
    ON public.coffee_shops (title);

CREATE INDEX IF NOT EXISTS idx_coffee_status
    ON public.coffee_shops (temporarily_closed, permanently_closed);

-- Add comment
COMMENT ON TABLE public.coffee_shops IS 'Coffee shops and cafes in Eilat with statistical area assignments and operating information';