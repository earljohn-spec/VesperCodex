import "server-only";
import { execute, newId, nowIso, parseJson, query, queryOne } from "../db";
import type { EmotionTag, JournalEntry } from "../types";
import { POSITIVE_EMOTIONS } from "../types";
import { toDateKey } from "../utils";

interface Row {
  id: string;
  user_id: string;
  title: string;
  body: string;
  mood_score: number;
  energy_score: number;
  emotions: string;
  source: string;
  transcript_ms: number | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
  synced: number;
}

function map(row: Row): JournalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    moodScore: row.mood_score,
    energyScore: row.energy_score,
    emotions: parseJson<EmotionTag[]>(row.emotions, []),
    source: row.source === "voice" ? "voice" : "text",
    transcriptMs: row.transcript_ms,
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1,
  };
}

export async function listEntries(
  userId: string,
  opts: { limit?: number; search?: string; emotion?: string; source?: string } = {},
): Promise<JournalEntry[]> {
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (opts.search) {
    clauses.push("(lower(title) LIKE ? OR lower(body) LIKE ?)");
    const like = `%${opts.search.toLowerCase()}%`;
    params.push(like, like);
  }
  if (opts.emotion) {
    clauses.push("emotions LIKE ?");
    params.push(`%"${opts.emotion}"%`);
  }
  if (opts.source && opts.source !== "all") {
    clauses.push("source = ?");
    params.push(opts.source);
  }

  const limit = opts.limit ?? 200;
  const rows = await query<Row>(
    `SELECT * FROM journal_entries WHERE ${clauses.join(" AND ")} ORDER BY entry_date DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map(map);
}

export async function getEntry(userId: string, id: string): Promise<JournalEntry | null> {
  const row = await queryOne<Row>(`SELECT * FROM journal_entries WHERE id = ? AND user_id = ?`, [
    id,
    userId,
  ]);
  return row ? map(row) : null;
}

export interface JournalInput {
  title?: string;
  body?: string;
  moodScore: number;
  energyScore?: number;
  emotions?: string[];
  source?: "text" | "voice";
  transcriptMs?: number | null;
  entryDate?: string;
  synced?: boolean;
}

export async function createEntry(userId: string, input: JournalInput): Promise<JournalEntry> {
  const id = newId("jrn");
  const ts = nowIso();
  await execute(
    `INSERT INTO journal_entries
      (id, user_id, title, body, mood_score, energy_score, emotions, source, transcript_ms, entry_date, created_at, updated_at, synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.title?.trim() || "",
      input.body?.trim() || "",
      input.moodScore,
      input.energyScore ?? 5,
      JSON.stringify(input.emotions ?? []),
      input.source ?? "text",
      input.transcriptMs ?? null,
      input.entryDate ?? ts,
      ts,
      ts,
      input.synced === false ? 0 : 1,
    ],
  );
  return (await getEntry(userId, id))!;
}

export async function updateEntry(
  userId: string,
  id: string,
  input: Partial<JournalInput>,
): Promise<JournalEntry | null> {
  const existing = await getEntry(userId, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (input.title !== undefined) push("title", input.title.trim());
  if (input.body !== undefined) push("body", input.body.trim());
  if (input.moodScore !== undefined) push("mood_score", input.moodScore);
  if (input.energyScore !== undefined) push("energy_score", input.energyScore);
  if (input.emotions !== undefined) push("emotions", JSON.stringify(input.emotions));
  if (input.source !== undefined) push("source", input.source);
  if (input.entryDate !== undefined) push("entry_date", input.entryDate);
  if (input.synced !== undefined) push("synced", input.synced ? 1 : 0);
  push("updated_at", nowIso());

  await execute(`UPDATE journal_entries SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return await getEntry(userId, id);
}

export async function deleteEntry(userId: string, id: string): Promise<boolean> {
  const existing = await getEntry(userId, id);
  if (!existing) return false;
  await execute(`DELETE FROM journal_entries WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/* ------------------------------- insights ------------------------------- */

export interface MoodTrendPoint {
  date: string;
  mood: number | null;
  energy: number | null;
  count: number;
}

export async function moodTrend(userId: string, days = 30): Promise<MoodTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await query<{ entry_date: string; mood_score: number; energy_score: number }>(
    `SELECT entry_date, mood_score, energy_score FROM journal_entries
     WHERE user_id = ? AND entry_date >= ? ORDER BY entry_date ASC`,
    [userId, since.toISOString()],
  );

  const buckets = new Map<string, { mood: number[]; energy: number[] }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(toDateKey(d), { mood: [], energy: [] });
  }
  for (const r of rows) {
    const key = toDateKey(r.entry_date);
    const b = buckets.get(key);
    if (b) {
      b.mood.push(r.mood_score);
      b.energy.push(r.energy_score);
    }
  }

  return [...buckets.entries()].map(([date, b]) => ({
    date,
    mood: b.mood.length ? +(b.mood.reduce((a, c) => a + c, 0) / b.mood.length).toFixed(2) : null,
    energy: b.energy.length
      ? +(b.energy.reduce((a, c) => a + c, 0) / b.energy.length).toFixed(2)
      : null,
    count: b.mood.length,
  }));
}

export interface EmotionCount {
  emotion: EmotionTag;
  count: number;
  positive: boolean;
}

export async function emotionBreakdown(userId: string, days = 30): Promise<EmotionCount[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await query<{ emotions: string }>(
    `SELECT emotions FROM journal_entries WHERE user_id = ? AND entry_date >= ?`,
    [userId, since.toISOString()],
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const e of parseJson<string[]>(r.emotions, [])) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([emotion, count]) => ({
      emotion: emotion as EmotionTag,
      count,
      positive: POSITIVE_EMOTIONS.has(emotion as EmotionTag),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface JournalStats {
  total: number;
  last30: number;
  avgMood30: number;
  avgMood7: number;
  avgEnergy7: number;
  moodDelta: number;
  voiceShare: number;
  streak: number;
  pendingSync: number;
  bestDay: { date: string; mood: number } | null;
  hardestDay: { date: string; mood: number } | null;
}

export async function journalStats(userId: string): Promise<JournalStats> {
  const total =
    (await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM journal_entries WHERE user_id = ?`, [
      userId,
    ]))?.c ?? 0;

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  const d7 = new Date();
  d7.setDate(d7.getDate() - 7);
  const d14 = new Date();
  d14.setDate(d14.getDate() - 14);

  const agg = async (since: Date) =>
    await queryOne<{ c: number; m: number | null; e: number | null }>(
      `SELECT COUNT(*) c, AVG(mood_score) m, AVG(energy_score) e
       FROM journal_entries WHERE user_id = ? AND entry_date >= ?`,
      [userId, since.toISOString()],
    );

  const a30 = await agg(d30);
  const a7 = await agg(d7);
  const prev7 = await queryOne<{ m: number | null }>(
    `SELECT AVG(mood_score) m FROM journal_entries
     WHERE user_id = ? AND entry_date >= ? AND entry_date < ?`,
    [userId, d14.toISOString(), d7.toISOString()],
  );

  const voice =
    (await queryOne<{ c: number }>(
      `SELECT COUNT(*) c FROM journal_entries WHERE user_id = ? AND source = 'voice' AND entry_date >= ?`,
      [userId, d30.toISOString()],
    ))?.c ?? 0;

  const pending =
    (await queryOne<{ c: number }>(
      `SELECT COUNT(*) c FROM journal_entries WHERE user_id = ? AND synced = 0`,
      [userId],
    ))?.c ?? 0;

  // streak of consecutive days with an entry
  const dayRows = await query<{ d: string }>(
    `SELECT DISTINCT substr(entry_date, 1, 10) d FROM journal_entries
     WHERE user_id = ? ORDER BY d DESC LIMIT 400`,
    [userId],
  );
  const daySet = new Set(dayRows.map((r) => r.d));
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const best = await queryOne<{ d: string; m: number }>(
    `SELECT substr(entry_date,1,10) d, AVG(mood_score) m FROM journal_entries
     WHERE user_id = ? AND entry_date >= ? GROUP BY d ORDER BY m DESC LIMIT 1`,
    [userId, d30.toISOString()],
  );
  const worst = await queryOne<{ d: string; m: number }>(
    `SELECT substr(entry_date,1,10) d, AVG(mood_score) m FROM journal_entries
     WHERE user_id = ? AND entry_date >= ? GROUP BY d ORDER BY m ASC LIMIT 1`,
    [userId, d30.toISOString()],
  );

  const avg7 = a7?.m ?? 0;
  const avgPrev = prev7?.m ?? 0;

  return {
    total,
    last30: a30?.c ?? 0,
    avgMood30: +(a30?.m ?? 0).toFixed(2),
    avgMood7: +avg7.toFixed(2),
    avgEnergy7: +(a7?.e ?? 0).toFixed(2),
    moodDelta: avgPrev ? +(avg7 - avgPrev).toFixed(2) : 0,
    voiceShare: a30?.c ? Math.round((voice / a30.c) * 100) : 0,
    streak,
    pendingSync: pending,
    bestDay: best ? { date: best.d, mood: +best.m.toFixed(1) } : null,
    hardestDay: worst ? { date: worst.d, mood: +worst.m.toFixed(1) } : null,
  };
}

/** Which hour of day tends to carry the lowest mood — used by the companion. */
export async function roughPatterns(userId: string) {
  const rows = await query<{ h: string; m: number; c: number }>(
    `SELECT substr(entry_date, 12, 2) h, AVG(mood_score) m, COUNT(*) c
     FROM journal_entries WHERE user_id = ? GROUP BY h HAVING c >= 2 ORDER BY m ASC`,
    [userId],
  );
  const weekday = await query<{ w: string; m: number; c: number }>(
    `SELECT strftime('%w', entry_date) w, AVG(mood_score) m, COUNT(*) c
     FROM journal_entries WHERE user_id = ? GROUP BY w HAVING c >= 2 ORDER BY m ASC`,
    [userId],
  );
  return { hardestHours: rows.slice(0, 2), hardestWeekdays: weekday.slice(0, 2) };
}
