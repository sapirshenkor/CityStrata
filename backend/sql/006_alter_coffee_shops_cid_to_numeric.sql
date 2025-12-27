-- Alter coffee_shops.cid column from BIGINT to NUMERIC
-- This is needed because some cid values exceed BIGINT range (e.g., 13304296502578382367)
-- NUMERIC can handle arbitrarily large integers

ALTER TABLE IF EXISTS public.coffee_shops 
    ALTER COLUMN cid TYPE NUMERIC;

