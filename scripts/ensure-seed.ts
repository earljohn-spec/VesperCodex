/**
 * Seeds the database only if it's missing or has no users, so `npm run dev`
 * always starts with a populated app but never clobbers real data.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.VESPER_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = process.env.VESPER_DB_PATH ?? path.join(DATA_DIR, "vesper.db");

function needsSeed(): boolean {
  if (!existsSync(DB_PATH)) return true;
  try {
    const db = new DatabaseSync(DB_PATH);
    const row = db
      .prepare(
        `SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='users'`,
      )
      .get() as { c: number };
    if (!row?.c) {
      db.close();
      return true;
    }
    const users = db.prepare(`SELECT count(*) AS c FROM users`).get() as { c: number };
    db.close();
    return users.c === 0;
  } catch {
    return true;
  }
}

if (needsSeed()) {
  console.log("· no data found — seeding demo content");
  execFileSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(process.cwd(), "scripts", "seed.ts"),
  ], { stdio: "inherit" });
} else {
  console.log("· database ready");
}
