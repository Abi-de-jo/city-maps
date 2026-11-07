CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS places (
  place_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_type TEXT,
  osm_id BIGINT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  address TEXT NOT NULL DEFAULT '',
  phone TEXT,
  website TEXT,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  average_rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS places_location_gix ON places USING GIST (location);
CREATE INDEX IF NOT EXISTS places_category_idx ON places (category) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS places_name_search_idx ON places USING GIN (to_tsvector('simple', name || ' ' || address));

CREATE TABLE IF NOT EXISTS reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  author_name TEXT NOT NULL CHECK (length(author_name) BETWEEN 1 AND 100),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_place_idx ON reviews (place_id, created_at DESC);

CREATE OR REPLACE FUNCTION refresh_place_rating() RETURNS TRIGGER AS $$
DECLARE target UUID := COALESCE(NEW.place_id, OLD.place_id);
BEGIN
  UPDATE places SET
    average_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE place_id = target AND status = 'published'), 0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE place_id = target AND status = 'published'),
    updated_at = NOW()
  WHERE place_id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_refresh_rating ON reviews;
CREATE TRIGGER reviews_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_place_rating();

CREATE TABLE IF NOT EXISTS osm_pois (
  osm_type TEXT NOT NULL,
  osm_id BIGINT NOT NULL,
  name TEXT,
  category TEXT NOT NULL,
  address TEXT,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS osm_pois_location_gix ON osm_pois USING GIST (location);
CREATE INDEX IF NOT EXISTS osm_pois_category_idx ON osm_pois (category);

CREATE TABLE IF NOT EXISTS traffic_overrides (
  edge_id TEXT PRIMARY KEY,
  road_name TEXT,
  speed_kph NUMERIC(6,2) NOT NULL CHECK (speed_kph > 0),
  normal_speed_kph NUMERIC(6,2) NOT NULL CHECK (normal_speed_kph > 0),
  geometry GEOMETRY(LINESTRING, 4326) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS traffic_geometry_gix ON traffic_overrides USING GIST (geometry);
CREATE INDEX IF NOT EXISTS traffic_expiry_idx ON traffic_overrides (expires_at);
