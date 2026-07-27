import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQLITE, SCHEMA_POSTGRES, COLUMN_MIGRATIONS } from "./schema";

/**
 * Dual-driver data layer.
 *
 * - **SQLite** (Node's built-in `node:sqlite`) is the default. Zero setup, no
 *   native build step — `npm run dev` just works.
 * - **Postgres** is used whenever `DATABASE_URL` is set. Required for any real
 *   deployment: SQLite on an ephemeral filesystem loses every write on
 *   redeploy, and it serialises concurrent writers.
 *
 * The API is async for both, so callers don't care which is underneath.
 * Placeholders are written `?` everywhere and rewritten to `$1, $2, …` for
 * Postgres by `toPgPlaceholders`.
 */

export type Driver = "sqlite" | "postgres";

export const driver: Driver = process.env.DATABASE_URL ? "postgres" : "sqlite";

const DATA_DIR = process.env.VESPER_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = process.env.VESPER_DB_PATH ?? path.join(DATA_DIR, "vesper.db");

export const dbPath = DB_PATH;

/* ------------------------------------------------------------------ */
/* Placeholder translation                                             */
/* ------------------------------------------------------------------ */

/**
 * Rewrites `?` placeholders to Postgres `$n`, skipping anything inside string
 * literals so a literal question mark in text isn't mangled.
 */
export function toPgPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !inDouble) {
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      out += c;
      continue;
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble;
      out += c;
      continue;
    }
    if (c === "?" && !inSingle && !inDouble) {
      out += `$${++n}`;
      continue;
    }
    out += c;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Adapters                                                            */
/* ------------------------------------------------------------------ */

interface Adapter {
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function createSqliteAdapter(): Adapter {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  return {
    async query<T>(sql: string, params: unknown[]) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async execute(sql: string, params: unknown[]) {
      db.prepare(sql).run(...(params as never[]));
    },
    async exec(sql: string) {
      db.exec(sql);
    },
    async transaction<T>(fn: () => Promise<T>) {
      db.exec("BEGIN");
      try {
        const r = await fn();
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      db.close();
    },
  };
}

function createPostgresAdapter(): Adapter {
  // `pg` is only needed when DATABASE_URL is set, so it stays out of the
  // SQLite path. eval() keeps the bundler from statically resolving it.
  const { Pool } = (0, eval)("require")("pg") as typeof import("pg");

  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Managed providers (Neon, Supabase, Heroku) terminate TLS with their own
    // CA, so strict verification fails against the default trust store.
    ssl: process.env.PGSSL === "disable" || isLocal ? undefined : { rejectUnauthorized: false },
  });

  return {
    async query<T>(sql: string, params: unknown[]) {
      const res = await pool.query(toPgPlaceholders(sql), params);
      return res.rows as T[];
    },
    async execute(sql: string, params: unknown[]) {
      await pool.query(toPgPlaceholders(sql), params);
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: () => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await fn();
        await client.query("COMMIT");
        return r;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Singleton + migration                                               */
/* ------------------------------------------------------------------ */

declare global {
  var __vesperAdapter: Adapter | undefined;
  var __vesperReady: Promise<void> | undefined;
}

function adapter(): Adapter {
  globalThis.__vesperAdapter ??=
    driver === "postgres" ? createPostgresAdapter() : createSqliteAdapter();
  return globalThis.__vesperAdapter;
}

async function runMigrations(a: Adapter) {
  await a.exec(driver === "postgres" ? SCHEMA_POSTGRES : SCHEMA_SQLITE);

  for (const m of COLUMN_MIGRATIONS) {
    if (driver === "postgres") {
      await a.exec(`ALTER TABLE ${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.pgDefinition}`);
    } else {
      const cols = await a.query<{ name: string }>(`PRAGMA table_info(${m.table})`, []);
      if (!cols.some((c) => c.name === m.column)) {
        await a.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
      }
    }
  }
}

/** Ensures the schema exists. Idempotent, and only ever runs once per process. */
export function ready(): Promise<void> {
  globalThis.__vesperReady ??= runMigrations(adapter());
  return globalThis.__vesperReady;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ready();
  return adapter().query<T>(sql, params);
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await ready();
  return adapter().execute(sql, params);
}

export async function exec(sql: string): Promise<void> {
  await ready();
  return adapter().exec(sql);
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  await ready();
  return adapter().transaction(fn);
}

export async function closeDb(): Promise<void> {
  if (globalThis.__vesperAdapter) {
    await globalThis.__vesperAdapter.close();
    globalThis.__vesperAdapter = undefined;
    globalThis.__vesperReady = undefined;
  }
}

/* -------------------------------- helpers -------------------------- */

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix = "id") {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${rand.replace(/-/g, "").slice(0, 20)}`;
}

/** SQLite returns 0/1 for booleans; Postgres returns real booleans. */
export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1" || v === "t";
}

/** Postgres JSONB comes back parsed; SQLite gives us a string. */
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* --------------------- portable SQL fragments ---------------------- */
/* SQLite and Postgres disagree on date functions; these paper over it. */

/** Date part (`YYYY-MM-DD`) of an ISO timestamp column. */
export const SQL_DATE_PART = (col: string) =>
  driver === "postgres" ? `substring(${col} from 1 for 10)` : `substr(${col}, 1, 10)`;

/** Hour of day, zero-padded, from an ISO timestamp column. */
export const SQL_HOUR_PART = (col: string) =>
  driver === "postgres" ? `substring(${col} from 12 for 2)` : `substr(${col}, 12, 2)`;

/** Day of week, 0=Sunday, from an ISO timestamp column. */
export const SQL_DOW = (col: string) =>
  driver === "postgres"
    ? `to_char((${col})::timestamptz, 'D')::int - 1`
    : `strftime('%w', ${col})`;

/** `INSERT … ON CONFLICT DO NOTHING`, spelled portably. */
export const SQL_INSERT = "INSERT";
export const SQL_ON_CONFLICT_NOTHING = " ON CONFLICT DO NOTHING";
