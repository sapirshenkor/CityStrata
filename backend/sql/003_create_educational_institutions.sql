-- Create educational institutions table
CREATE TABLE IF NOT EXISTS public.educational_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Institution identifiers
    institution_code TEXT NOT NULL UNIQUE,
    institution_name TEXT NOT NULL,
    
    -- Address information
    address TEXT,
    full_address TEXT,
    
    -- Institution classification
    type_of_supervision TEXT,
    type_of_education TEXT,
    education_phase TEXT,
    
    -- Location (point geometry)
    location GEOMETRY(Point, 4326) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    
    -- Foreign key to statistical areas
    stat_2022 INTEGER NOT NULL,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_stat_area 
        FOREIGN KEY (stat_2022) 
        REFERENCES public.statistical_areas(stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_edu_inst_location
    ON public.educational_institutions USING gist (location);

CREATE INDEX IF NOT EXISTS idx_edu_inst_stat_area
    ON public.educational_institutions (stat_2022);

CREATE INDEX IF NOT EXISTS idx_edu_inst_name
    ON public.educational_institutions (institution_name);

CREATE INDEX IF NOT EXISTS idx_edu_inst_phase
    ON public.educational_institutions (education_phase);

-- Add comment
COMMENT ON TABLE public.educational_institutions IS 'Educational institutions in Eilat with statistical area assignments';