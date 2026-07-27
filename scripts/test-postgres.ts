/**
 * Verifies the Postgres code path.
 *
 * Runs against PGlite — genuine Postgres compiled to WASM — so the real
 * Postgres parser, planner, type system and constraint machinery are
 * exercised without needing a server. It applies the same SCHEMA_POSTGRES the
 * app uses and replays every query shape the repositories issue, including
 * the `?` → `$n` placeholder rewriting.
 *
 * Run with: npm run test:pg
 */
import "./_shim";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_POSTGRES, COLUMN_MIGRATIONS } from "../src/lib/schema";
import { toPgPlaceholders } from "../src/lib/db";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

const db = new PGlite();
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query(toPgPlaceholders(sql), params)).rows as T[];
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await q<T>(sql, params))[0] ?? null;

async function main() {
  console.log("\n── SCHEMA");
  await db.exec(SCHEMA_POSTGRES);
  for (const m of COLUMN_MIGRATIONS) {
    await db.exec(`ALTER TABLE ${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.pgDefinition}`);
  }
  const tables = await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );
  t("all tables created", tables.length === 14, `(${tables.length})`);
  t("migration column applied", !!(await one(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='users' AND column_name='password_changed_at'`,
  )));
  t("schema is idempotent", await (async () => {
    await db.exec(SCHEMA_POSTGRES);
    return true;
  })());

  console.log("\n── PLACEHOLDER REWRITING");
  t("simple", toPgPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?") ===
    "SELECT * FROM t WHERE a = $1 AND b = $2");
  t("question mark inside a string literal is left alone",
    toPgPlaceholders("SELECT 'why?' WHERE a = ?") === "SELECT 'why?' WHERE a = $1");
  t("escaped quotes survive",
    toPgPlaceholders("SELECT 'it''s ok?' WHERE a = ?") === "SELECT 'it''s ok?' WHERE a = $1");

  console.log("\n── CRUD + CONSTRAINTS");
  const now = new Date().toISOString();
  await q(
    `INSERT INTO users (id,email,name,password_hash,avatar_hue,timezone,focus_areas,onboarded,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ["u1", "a@b.c", "Tester", "scrypt:x:y", 265, "UTC", "[]", false, now, now],
  );
  t("insert user", !!(await one(`SELECT id FROM users WHERE id = ?`, ["u1"])));

  let dupBlocked = false;
  try {
    await q(
      `INSERT INTO users (id,email,name,password_hash,created_at,updated_at)
       VALUES (?,?,?,?,?,?)`,
      ["u2", "a@b.c", "Dup", "x", now, now],
    );
  } catch {
    dupBlocked = true;
  }
  t("unique email enforced", dupBlocked);

  let fkBlocked = false;
  try {
    await q(
      `INSERT INTO journal_entries (id,user_id,mood_score,entry_date,created_at,updated_at)
       VALUES (?,?,?,?,?,?)`,
      ["j-orphan", "nobody", 5, now, now, now],
    );
  } catch {
    fkBlocked = true;
  }
  t("foreign key enforced", fkBlocked);

  console.log("\n── BOOLEANS (real BOOLEAN, not 0/1)");
  await q(
    `INSERT INTO journal_entries (id,user_id,title,body,mood_score,energy_score,emotions,source,entry_date,created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ["j1", "u1", "T", "B", 7, 6, JSON.stringify(["calm"]), "text", now, now, now, true],
  );
  const jr = await one<{ synced: boolean }>(`SELECT synced FROM journal_entries WHERE id = ?`, ["j1"]);
  t("boolean round-trips as true", jr?.synced === true);

  await q(`INSERT INTO habits (id,user_id,name,created_at,updated_at,archived) VALUES (?,?,?,?,?,?)`,
    ["h1", "u1", "Walk", now, now, false]);
  const hr = await one<{ archived: boolean }>(`SELECT archived FROM habits WHERE id = ?`, ["h1"]);
  t("boolean round-trips as false", hr?.archived === false);

  console.log("\n── AGGREGATES the repos rely on");
  for (let i = 2; i <= 6; i++) {
    await q(
      `INSERT INTO journal_entries (id,user_id,mood_score,energy_score,emotions,entry_date,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [`j${i}`, "u1", i, i, "[]", new Date(Date.now() - i * 86400000).toISOString(), now, now],
    );
  }
  const agg = await one<{ c: string; m: string }>(
    `SELECT COUNT(*) c, AVG(mood_score) m FROM journal_entries WHERE user_id = ?`,
    ["u1"],
  );
  t("COUNT + AVG", Number(agg!.c) === 6, `count=${agg!.c} avg=${Number(agg!.m).toFixed(2)}`);

  // substring() is the portable date-part used by SQL_DATE_PART
  const byDay = await q<{ d: string; m: string }>(
    `SELECT substring(entry_date from 1 for 10) d, AVG(mood_score) m
     FROM journal_entries WHERE user_id = ? GROUP BY d ORDER BY d`,
    ["u1"],
  );
  t("date-part grouping", byDay.length >= 5, `${byDay.length} day buckets`);

  const dow = await q<{ w: number }>(
    `SELECT to_char((entry_date)::timestamptz, 'D')::int - 1 w FROM journal_entries WHERE user_id = ? LIMIT 1`,
    ["u1"],
  );
  t("day-of-week extraction", dow.length === 1 && dow[0].w >= 0 && dow[0].w <= 6, `w=${dow[0]?.w}`);

  console.log("\n── UPSERT (rate limiter)");
  await q(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
    ["login:1.2.3.4", now],
  );
  await q(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
    ["login:1.2.3.4", now],
  );
  const rl = await q(`SELECT * FROM rate_limits WHERE key = ?`, ["login:1.2.3.4"]);
  t("ON CONFLICT upsert leaves one row", rl.length === 1);

  console.log("\n── UNIQUE(habit_id, log_date) + conflict-ignore");
  await q(
    `INSERT INTO habit_logs (id,habit_id,user_id,log_date,completed,note,created_at)
     VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    ["hl1", "h1", "u1", "2026-07-01", true, "", now],
  );
  await q(
    `INSERT INTO habit_logs (id,habit_id,user_id,log_date,completed,note,created_at)
     VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    ["hl2", "h1", "u1", "2026-07-01", true, "", now],
  );
  const logs = await q(`SELECT * FROM habit_logs WHERE habit_id = ?`, ["h1"]);
  t("duplicate log ignored", logs.length === 1);

  console.log("\n── SUBQUERIES (conversation list)");
  await q(`INSERT INTO conversations (id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)`,
    ["c1", "u1", "Chat", now, now]);
  await q(
    `INSERT INTO messages (id,conversation_id,user_id,role,content,context_used,created_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["m1", "c1", "u1", "user", "hello", "[]", now],
  );
  const convs = await q<{ message_count: string; last_message: string }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT m.content FROM messages m WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM conversations c WHERE c.user_id = ? ORDER BY c.pinned DESC, c.updated_at DESC`,
    ["u1"],
  );
  t("correlated subqueries", Number(convs[0].message_count) === 1 && convs[0].last_message === "hello");

  console.log("\n── LIKE filters (journal search)");
  const search = await q(
    `SELECT id FROM journal_entries WHERE user_id = ? AND (lower(title) LIKE ? OR lower(body) LIKE ?)`,
    ["u1", "%t%", "%t%"],
  );
  t("LIKE search", search.length >= 1, `${search.length} hits`);
  const emo = await q(`SELECT id FROM journal_entries WHERE emotions LIKE ?`, ['%"calm"%']);
  t("emotion tag LIKE", emo.length === 1);

  console.log("\n── CASCADE DELETE");
  const before = await one<{ c: string }>(`SELECT COUNT(*) c FROM journal_entries`);
  await q(`DELETE FROM users WHERE id = ?`, ["u1"]);
  const afterJ = await one<{ c: string }>(`SELECT COUNT(*) c FROM journal_entries`);
  const afterM = await one<{ c: string }>(`SELECT COUNT(*) c FROM messages`);
  const afterH = await one<{ c: string }>(`SELECT COUNT(*) c FROM habit_logs`);
  t("cascade removes entries", Number(before!.c) > 0 && Number(afterJ!.c) === 0);
  t("cascade removes messages", Number(afterM!.c) === 0);
  t("cascade removes habit logs", Number(afterH!.c) === 0);

  console.log("\n── TRANSACTION ROLLBACK");
  await q(
    `INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    ["u3", "t@x.c", "Tx", "h", now, now],
  );
  try {
    await db.exec("BEGIN");
    await q(`UPDATE users SET name = ? WHERE id = ?`, ["Changed", "u3"]);
    throw new Error("boom");
  } catch {
    await db.exec("ROLLBACK");
  }
  const rolled = await one<{ name: string }>(`SELECT name FROM users WHERE id = ?`, ["u3"]);
  t("rollback restores state", rolled?.name === "Tx");

  await db.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
