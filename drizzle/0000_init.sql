CREATE TABLE IF NOT EXISTS tier_lists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'My Tier List',
  creator_name TEXT NOT NULL DEFAULT 'Anonymous',
  edit_password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tiers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  tier_list_id TEXT NOT NULL REFERENCES tier_lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  "order" INTEGER NOT NULL,
  tier_id TEXT REFERENCES tiers(id) ON DELETE CASCADE,
  tier_list_id TEXT NOT NULL REFERENCES tier_lists(id) ON DELETE CASCADE,
  is_unsorted INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  tier_list_id TEXT NOT NULL REFERENCES tier_lists(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS live_session_users (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL
);
