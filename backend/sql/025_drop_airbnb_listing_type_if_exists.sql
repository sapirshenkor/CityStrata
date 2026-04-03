-- Revert optional listing_type column if migration 025_airbnb_listing_type was applied.
ALTER TABLE public.airbnb_listings
  DROP COLUMN IF EXISTS listing_type;
