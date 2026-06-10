-- TAO VPN core schema

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  telegram_id     TEXT UNIQUE,
  telegram_handle TEXT,
  phone           TEXT UNIQUE,
  email           TEXT UNIQUE,
  primary_method  TEXT NOT NULL CHECK (primary_method IN ('telegram','phone','email')),
  is_admin        INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  last_seen_at    INTEGER
);

-- Whitelist for invite-only registration.
-- Admin pre-adds at least one identity; user can claim via any matching method.
CREATE TABLE IF NOT EXISTS invites (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  telegram_id  TEXT,
  phone        TEXT,
  email        TEXT,
  used_by      TEXT REFERENCES users(id),
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_tg    ON invites(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invites_phone ON invites(phone)       WHERE phone       IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email)       WHERE email       IS NOT NULL;

-- One-time codes (SMS / email magic links)
CREATE TABLE IF NOT EXISTS otp_codes (
  id           TEXT PRIMARY KEY,
  channel      TEXT NOT NULL CHECK (channel IN ('phone','email')),
  target       TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL,
  consumed_at  INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_target ON otp_codes(channel, target);

-- Long-lived sessions (90 days)
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_label  TEXT,
  user_agent    TEXT,
  ip            TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  revoked_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- VPN servers (admin-managed)
CREATE TABLE IF NOT EXISTS servers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  location   TEXT NOT NULL,
  protocol   TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('online','maintenance','offline')) DEFAULT 'online',
  latency_ms INTEGER,
  load_pct   INTEGER DEFAULT 0,
  position   INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Per-user VPN configs
CREATE TABLE IF NOT EXISTS configs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id  TEXT NOT NULL REFERENCES servers(id),
  name       TEXT NOT NULL,
  uri        TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_configs_user ON configs(user_id);

-- Broadcast notifications (history)
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('info','warning','error','success','config')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT 'all',  -- 'all' or user_id
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Active "urgent" banner shown on Status screen (only one active at a time)
CREATE TABLE IF NOT EXISTS urgent_message (
  id         INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton
  active     INTEGER NOT NULL DEFAULT 0,
  type       TEXT,
  title      TEXT,
  body       TEXT,
  cta_label  TEXT,
  cta_tab    TEXT,  -- 'configs' | 'alerts' | etc
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO urgent_message (id, active, updated_at) VALUES (1, 0, 0);

-- Web Push subscriptions (per-device)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER,
  failures   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
