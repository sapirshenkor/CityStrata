-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the 'embedding' column to all relevant tables 
ALTER TABLE airbnb_listings ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE synagogues ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE educational_institutions ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE matnasim ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE hotels_listings ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE coffee_shops ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE osm_city_facilities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create indexes for fast similarity search 
CREATE INDEX IF NOT EXISTS airbnb_listings_embedding_idx ON airbnb_listings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS synagogues_embedding_idx ON synagogues USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS edu_institutions_embedding_idx ON educational_institutions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS matnasim_embedding_idx ON matnasim USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS hotels_listings_embedding_idx ON hotels_listings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS coffee_shops_embedding_idx ON coffee_shops USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS restaurants_embedding_idx ON restaurants USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS osm_city_facilities_embedding_idx ON osm_city_facilities USING hnsw (embedding vector_cosine_ops);