CREATE TABLE IF NOT EXISTS app_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  data jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notes (
  owner_id varchar(64) NOT NULL, id uuid NOT NULL, markdown text NOT NULL DEFAULT '',
  color varchar(7) NOT NULL, x double precision NOT NULL, y double precision NOT NULL,
  width integer NOT NULL, height integer NOT NULL, angle double precision NOT NULL,
  curl double precision NOT NULL, tape boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false, version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,id), CHECK(length(markdown)<=20000), CHECK(width BETWEEN 180 AND 1000), CHECK(height BETWEEN 160 AND 1000)
);
CREATE INDEX IF NOT EXISTS notes_owner_updated ON notes(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS preferences (
  owner_id varchar(64) PRIMARY KEY, data jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wallpapers (
  photo_id varchar(128) PRIMARY KEY, topic varchar(64) NOT NULL, data jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (
  owner_id varchar(64) NOT NULL, photo_id varchar(128) NOT NULL REFERENCES wallpapers(photo_id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,photo_id)
);
CREATE TABLE IF NOT EXISTS admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id varchar(64) NOT NULL,
  action varchar(64) NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
