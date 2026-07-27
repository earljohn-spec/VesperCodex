import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Vesper uses Node's built-in SQLite driver (node:sqlite, Node >= 22.5).
 * This keeps the app dependency-free of native build toolchains while still
 * giving us a real, file-backed relational database with transactions.
 */

const DATA_DIR = process.env.VESPER_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = process.env.VESPER_DB_PATH ?? path.join(DATA_DIR, "vesper.db");

declare global {
  var __vesperDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

/** Singleton across hot-reloads in dev. */
export function getDb(): DatabaseSync {
  if (!globalThis.__vesperDb) {
    globalThis.__vesperDb = createConnection();
  }
  return globalThis.__vesperDb;
}

export const dbPath = DB_PATH;

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const SCHEMA = `
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

-- Password reset ---------------------------------------------------------
-- Only the SHA-256 of the token is stored, so a database leak doesn't hand
-- an attacker working reset links.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

-- Rate limiting (fixed window) -------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TEXT NOT NULL
);

-- Mood / journal entries -------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  mood_score    INTEGER NOT NULL,          -- 1..10
  energy_score  INTEGER NOT NULL DEFAULT 5,-- 1..10
  emotions      TEXT NOT NULL DEFAULT '[]',-- JSON array of tags
  source        TEXT NOT NULL DEFAULT 'text', -- text | voice
  transcript_ms INTEGER,                   -- length of voice note, if any
  entry_date    TEXT NOT NULL,             -- ISO timestamp of the moment journaled
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  synced        INTEGER NOT NULL DEFAULT 1 -- 0 when captured offline, pending sync
);
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);

-- Habits -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT 'sparkles',
  color         TEXT NOT NULL DEFAULT 'violet',
  cadence       TEXT NOT NULL DEFAULT 'daily', -- daily | weekdays | weekly
  target_per_week INTEGER NOT NULL DEFAULT 7,
  reminder_time TEXT,                          -- 'HH:MM' or null
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived);

CREATE TABLE IF NOT EXISTS habit_logs (
  id            TEXT PRIMARY KEY,
  habit_id      TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date      TEXT NOT NULL,   -- YYYY-MM-DD
  completed     INTEGER NOT NULL DEFAULT 1,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date DESC);

-- Conversations ----------------------------------------------------------
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
  role            TEXT NOT NULL,  -- user | assistant
  content         TEXT NOT NULL,
  strategy        TEXT,           -- coping strategy label attached by the companion
  context_used    TEXT NOT NULL DEFAULT '[]', -- JSON array of memory keys referenced
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Long-term memory the companion accumulates -----------------------------
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,   -- trigger | strategy | preference | milestone | person
  label         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  weight        REAL NOT NULL DEFAULT 1,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, kind);

-- Wearables & biometrics -------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,  -- apple_watch | fitbit | oura | garmin | manual
  display_name   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'connected', -- connected | syncing | paused | error
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
  hrv           REAL,     -- ms (RMSSD)
  resting_hr    REAL,     -- bpm
  heart_rate    REAL,     -- bpm at sample time
  respiration   REAL,     -- breaths/min
  sleep_hours   REAL,
  steps         INTEGER,
  stress_index  REAL NOT NULL DEFAULT 0, -- 0..100 derived
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biometrics_user_time ON biometrics(user_id, recorded_at DESC);

-- Stress spike alerts + micro-break interventions ------------------------
CREATE TABLE IF NOT EXISTS interventions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biometric_id  TEXT REFERENCES biometrics(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,  -- breathing | micro_break | grounding | movement | reflection
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  duration_sec  INTEGER NOT NULL DEFAULT 120,
  trigger_note  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'suggested', -- suggested | completed | dismissed | snoozed
  triggered_at  TEXT NOT NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interventions_user ON interventions(user_id, status, triggered_at DESC);

-- Offline sync outbox ----------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource      TEXT NOT NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'synced', -- pending | synced | failed
  created_at    TEXT NOT NULL,
  synced_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_events(user_id, status, created_at DESC);
`;

/**
 * Columns added after the initial release. `CREATE TABLE IF NOT EXISTS` only
 * covers new tables, so existing databases need these applied explicitly.
 */
const COLUMN_MIGRATIONS: { table: string; column: string; definition: string }[] = [
  // Lets us invalidate sessions issued before a password change.
  { table: "users", column: "password_changed_at", definition: "TEXT" },
];

function migrate(db: DatabaseSync) {
  db.exec(SCHEMA);

  for (const m of COLUMN_MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all() as { name: string }[];
    if (cols.some((c) => c.name === m.column)) continue;
    db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Params = Record<string, unknown> | unknown[];

function normalize(params?: Params): unknown[] {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  return [params];
}

export function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...(normalize(params) as never[])) as T[];
}

export function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
  const stmt = getDb().prepare(sql);
  const row = stmt.get(...(normalize(params) as never[]));
  return (row as T) ?? null;
}

export function execute(sql: string, params?: unknown[]) {
  const stmt = getDb().prepare(sql);
  return stmt.run(...(normalize(params) as never[]));
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix = "id") {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${rand.replace(/-/g, "").slice(0, 20)}`;
}

/** Booleans come back from SQLite as 0/1 integers. */
export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
