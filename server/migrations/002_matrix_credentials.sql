-- Matrix auto-provisioning credentials
-- Stores Matrix access tokens created via Synapse Admin API
-- One-to-one with users table

CREATE TABLE IF NOT EXISTS matrix_credentials (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matrix_user_id  TEXT NOT NULL UNIQUE,   -- @username:space.taodev.net
  access_token    TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  homeserver_url  TEXT NOT NULL,
  display_name    TEXT,
  avatar_mxc      TEXT,                   -- mxc:// URL synced from VPN profile
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
