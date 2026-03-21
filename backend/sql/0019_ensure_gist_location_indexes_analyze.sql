-- Optional Supabase / production check: spatial + vector indexes for MCP tactical tools.
-- Run in SQL editor if listings search is slow or appears to hang (planner may seq-scan).
-- GiST on geometry(location) is required for fast ST_DWithin / && filters.
-- HNSW on embedding is created in 0018; this file only ensures GiST + fresh stats.

-- Inspect current indexes (uncomment to run):
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('airbnb_listings', 'hotels_listings');

CREATE INDEX IF NOT EXISTS idx_airbnb_location
    ON public.airbnb_listings USING gist (location);

CREATE INDEX IF NOT EXISTS idx_hotels_location
    ON public.hotels_listings USING gist (location);

ANALYZE public.airbnb_listings;
ANALYZE public.hotels_listings;
