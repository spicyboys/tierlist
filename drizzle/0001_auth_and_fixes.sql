-- Users table for email/password auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Anonymous',
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Add owner_id to tier_lists (nullable for backward compat with existing lists)
ALTER TABLE tier_lists ADD COLUMN owner_id TEXT REFERENCES users(id);
