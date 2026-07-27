/**
 * Schema in both dialects.
 *
 * They're kept side by side rather than generated so the differences are
 * visible: Postgres gets real BOOLEAN / TIMESTAMPTZ / JSONB / DOUBLE
 * PRECISION, SQLite gets INTEGER / TEXT / REAL. Application code reads both
 * through `bool()` and `parseJson()` in db.ts.
 */

export const SCHEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  avatar_hue        INTEGER NOT NULL DEFAULT 265,
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  focus_areas       TEXT NOT NULL DEFAULT '[]',
  onboarded         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  mood_score    INTEGER NOT NULL,
  energy_score  INTEGER NOT NULL DEFAULT 5,
  emotions      TEXT NOT NULL DEFAULT '[]',
  source        TEXT NOT NULL DEFAULT 'text',
  transcript_ms INTEGER,
  entry_date    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  synced        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT 'sparkles',
  color         TEXT NOT NULL DEFAULT 'violet',
  cadence       TEXT NOT NULL DEFAULT 'daily',
  target_per_week INTEGER NOT NULL DEFAULT 7,
  reminder_time TEXT,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived);

CREATE TABLE IF NOT EXISTS habit_logs (
  id            TEXT PRIMARY KEY,
  habit_id      TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date      TEXT NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 1,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'New conversation',
  summary       TEXT NOT NULL DEFAULT '',
  pinned        INTEGER NOT NULL DEFAULT 0,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, archived, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  strategy        TEXT,
  context_used    TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  label         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  weight        REAL NOT NULL DEFAULT 1,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, kind);

CREATE TABLE IF NOT EXISTS devices (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'connected',
  battery        INTEGER,
  last_sync_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS biometrics (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT REFERENCES devices(id) ON DELETE SET NULL,
  recorded_at   TEXT NOT NULL,
  hrv           REAL,
  resting_hr    REAL,
  heart_rate    REAL,
  respiration   REAL,
  sleep_hours   REAL,
  steps         INTEGER,
  stress_index  REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biometrics_user_time ON biometrics(user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS interventions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biometric_id  TEXT REFERENCES biometrics(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  duration_sec  INTEGER NOT NULL DEFAULT 120,
  trigger_note  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'suggested',
  triggered_at  TEXT NOT NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interventions_user ON interventions(user_id, status, triggered_at DESC);

CREATE TABLE IF NOT EXISTS sync_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource      TEXT NOT NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'synced',
  created_at    TEXT NOT NULL,
  synced_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_events(user_id, status, created_at DESC);
`;

export const SCHEMA_POSTGRES = `
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  avatar_hue        INTEGER NOT NULL DEFAULT 265,
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  focus_areas       TEXT NOT NULL DEFAULT '[]',
  onboarded         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  mood_score    INTEGER NOT NULL,
  energy_score  INTEGER NOT NULL DEFAULT 5,
  emotions      TEXT NOT NULL DEFAULT '[]',
  source        TEXT NOT NULL DEFAULT 'text',
  transcript_ms INTEGER,
  entry_date    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  synced        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT 'sparkles',
  color         TEXT NOT NULL DEFAULT 'violet',
  cadence       TEXT NOT NULL DEFAULT 'daily',
  target_per_week INTEGER NOT NULL DEFAULT 7,
  reminder_time TEXT,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived);

CREATE TABLE IF NOT EXISTS habit_logs (
  id            TEXT PRIMARY KEY,
  habit_id      TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date      TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT TRUE,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'New conversation',
  summary       TEXT NOT NULL DEFAULT '',
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, archived, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  strategy        TEXT,
  context_used    TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  label         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  weight        DOUBLE PRECISION NOT NULL DEFAULT 1,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, kind);

CREATE TABLE IF NOT EXISTS devices (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'connected',
  battery        INTEGER,
  last_sync_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS biometrics (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT REFERENCES devices(id) ON DELETE SET NULL,
  recorded_at   TEXT NOT NULL,
  hrv           DOUBLE PRECISION,
  resting_hr    DOUBLE PRECISION,
  heart_rate    DOUBLE PRECISION,
  respiration   DOUBLE PRECISION,
  sleep_hours   DOUBLE PRECISION,
  steps         INTEGER,
  stress_index  DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biometrics_user_time ON biometrics(user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS interventions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biometric_id  TEXT REFERENCES biometrics(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  duration_sec  INTEGER NOT NULL DEFAULT 120,
  trigger_note  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'suggested',
  triggered_at  TEXT NOT NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interventions_user ON interventions(user_id, status, triggered_at DESC);

CREATE TABLE IF NOT EXISTS sync_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource      TEXT NOT NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'synced',
  created_at    TEXT NOT NULL,
  synced_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_events(user_id, status, created_at DESC);
`;

/** Columns added after the initial release. */
export const COLUMN_MIGRATIONS: {
  table: string;
  column: string;
  definition: string;
  pgDefinition: string;
}[] = [
  {
    table: "users",
    column: "password_changed_at",
    definition: "TEXT",
    pgDefinition: "TEXT",
  },
];
