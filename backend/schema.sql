CREATE TABLE IF NOT EXISTS app_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  data jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
-- Shared public Unsplash metadata cache; never stores a user's collection.
CREATE TABLE IF NOT EXISTS wallpapers (
  photo_id varchar(128) PRIMARY KEY, topic varchar(64) NOT NULL, data jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallpapers_topic ON wallpapers(topic);
CREATE TABLE IF NOT EXISTS wallpaper_devices (
  id uuid PRIMARY KEY, ticket_hash bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wallpaper_usage (
  actor_key varchar(128) NOT NULL, actor_kind varchar(8) NOT NULL CHECK(actor_kind IN ('device','user')),
  day date NOT NULL, used integer NOT NULL DEFAULT 0 CHECK(used>=0),
  succeeded integer NOT NULL DEFAULT 0, failed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_key,day)
);
CREATE INDEX IF NOT EXISTS wallpaper_usage_day ON wallpaper_usage(day DESC);
-- Only idempotency/settlement receipts: no photo id, topic, note, email or settings.
CREATE TABLE IF NOT EXISTS wallpaper_query_receipts (
  actor_key varchar(128) NOT NULL, request_id uuid NOT NULL, day date NOT NULL,
  status varchar(12) NOT NULL CHECK(status IN ('pending','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_key,request_id)
);
CREATE INDEX IF NOT EXISTS wallpaper_query_pending ON wallpaper_query_receipts(actor_key,created_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id varchar(64) NOT NULL,
  action varchar(64) NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
