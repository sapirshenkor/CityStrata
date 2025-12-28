-- Create OSM facilities table
CREATE TABLE IF NOT EXISTS public.osm_city_facilities (
    -- Primary key
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Facility information from OpenStreetMap
    name TEXT,
    facility_type TEXT NOT NULL,
    
    -- Location information
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    
    -- Statistical area reference (Composite Foreign Key)
    semel_yish INTEGER NOT NULL DEFAULT 2600,  -- Eilat code
    stat_2022 INTEGER NOT NULL,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    -- Links to your master statistical_areas table using the unique composite key
    CONSTRAINT fk_osm_facility_stat_area 
        FOREIGN KEY (semel_yish, stat_2022) 
        REFERENCES public.statistical_areas(semel_yish, stat_2022)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for performance
-- 1. Spatial index for proximity searches (GIST)
CREATE INDEX IF NOT EXISTS idx_osm_facilities_location
    ON public.osm_city_facilities USING gist (location);

-- 2. Statistical area index for neighborhood-level analysis
CREATE INDEX IF NOT EXISTS idx_osm_facilities_stat_area
    ON public.osm_city_facilities (stat_2022);

-- 3. City code index
CREATE INDEX IF NOT EXISTS idx_osm_facilities_semel
    ON public.osm_city_facilities (semel_yish);

-- 4. Category index (filtering by 'school', 'park', 'pharmacy', etc.)
CREATE INDEX IF NOT EXISTS idx_osm_facilities_type
    ON public.osm_city_facilities (facility_type);

-- 5. Text index for name-based searches
CREATE INDEX IF NOT EXISTS idx_osm_facilities_name
    ON public.osm_city_facilities (name);

-- Add descriptive comment
COMMENT ON TABLE public.osm_city_facilities IS 'Eilat city facilities and points of interest imported from OpenStreetMap with statistical area assignments';

/*-------------------------------------------------------------------------------------------------------------------------*/
/* Post-Import Script
After uploading run this final command to convert the Lat/Lng columns into the native PostGIS location format and add uniqe constraint:*/

UPDATE public.osm_city_facilities 
SET location = ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)
WHERE location IS NULL;

ALTER TABLE public.osm_city_facilities 
ADD CONSTRAINT unique_osm_facility UNIQUE (name, facility_type, location_lat, location_lng);
/*-------------------------------------------------------------------------------------------------------------------------*/
