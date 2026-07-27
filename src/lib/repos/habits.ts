import "server-only";
import { execute, newId, nowIso, query, queryOne } from "../db";
import type { Habit, HabitCadence, HabitLog, HabitWithStats } from "../types";
import { toDateKey, todayKey } from "../utils";

interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  cadence: string;
  target_per_week: number;
  reminder_time: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface LogRow {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  completed: number;
  note: string;
  created_at: string;
}

function mapHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    cadence: row.cadence as HabitCadence,
    targetPerWeek: row.target_per_week,
    reminderTime: row.reminder_time,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLog(row: LogRow): HabitLog {
  return {
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    logDate: row.log_date,
    completed: row.completed === 1,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listHabits(userId: string, includeArchived = false): Promise<HabitWithStats[]> {
  const rows = await query<HabitRow>(
    `SELECT * FROM habits WHERE user_id = ? ${includeArchived ? "" : "AND archived = 0"}
     ORDER BY archived ASC, created_at ASC`,
    [userId],
  );
  const logs = await query<LogRow>(
    `SELECT * FROM habit_logs WHERE user_id = ? AND completed = 1 ORDER BY log_date DESC`,
    [userId],
  );
  const byHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Set());
    byHabit.get(l.habit_id)!.add(l.log_date);
  }
  return rows.map((r) => withStats(mapHabit(r), byHabit.get(r.id) ?? new Set()));
}

function withStats(habit: Habit, days: Set<string>): HabitWithStats {
  const today = todayKey();

  // current streak
  let streak = 0;
  const cursor = new Date();
  if (!days.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // longest streak
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = new Date(`${d}T00:00:00`);
    if (prev && (cur.getTime() - prev.getTime()) / 86400000 === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = cur;
  }

  // this week (Mon start)
  const weekStart = new Date();
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
  weekStart.setHours(0, 0, 0, 0);
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (days.has(toDateKey(d))) thisWeek++;
  }

  // last 14 day grid
  const last14: { date: string; completed: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    last14.push({ date: key, completed: days.has(key) });
  }

  const last28 = (() => {
    let hit = 0;
    for (let i = 0; i < 28; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (days.has(toDateKey(d))) hit++;
    }
    return hit;
  })();
  const expected = Math.max(1, Math.round((habit.targetPerWeek / 7) * 28));

  return {
    ...habit,
    currentStreak: streak,
    longestStreak: longest,
    completionsThisWeek: thisWeek,
    completedToday: days.has(today),
    last14,
    adherence: Math.min(100, Math.round((last28 / expected) * 100)),
  };
}

export async function getHabit(userId: string, id: string): Promise<HabitWithStats | null> {
  const row = await queryOne<HabitRow>(`SELECT * FROM habits WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!row) return null;
  const logs = await query<LogRow>(
    `SELECT * FROM habit_logs WHERE habit_id = ? AND completed = 1`,
    [id],
  );
  return withStats(mapHabit(row), new Set(logs.map((l) => l.log_date)));
}

export interface HabitInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  cadence?: HabitCadence;
  targetPerWeek?: number;
  reminderTime?: string | null;
  archived?: boolean;
}

export async function createHabit(userId: string, input: HabitInput): Promise<HabitWithStats> {
  const id = newId("hab");
  const ts = nowIso();
  await execute(
    `INSERT INTO habits (id, user_id, name, description, icon, color, cadence, target_per_week, reminder_time, archived, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`,
    [
      id,
      userId,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.icon ?? "sparkles",
      input.color ?? "violet",
      input.cadence ?? "daily",
      input.targetPerWeek ?? 7,
      input.reminderTime ?? null,
      ts,
      ts,
    ],
  );
  return (await getHabit(userId, id))!;
}

export async function updateHabit(
  userId: string,
  id: string,
  input: Partial<HabitInput>,
): Promise<HabitWithStats | null> {
  if (!await getHabit(userId, id)) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    params.push(v);
  };
  if (input.name !== undefined) push("name", input.name.trim());
  if (input.description !== undefined) push("description", input.description.trim());
  if (input.icon !== undefined) push("icon", input.icon);
  if (input.color !== undefined) push("color", input.color);
  if (input.cadence !== undefined) push("cadence", input.cadence);
  if (input.targetPerWeek !== undefined) push("target_per_week", input.targetPerWeek);
  if (input.reminderTime !== undefined) push("reminder_time", input.reminderTime);
  if (input.archived !== undefined) push("archived", input.archived ? 1 : 0);
  push("updated_at", nowIso());
  await execute(`UPDATE habits SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return await getHabit(userId, id);
}

export async function deleteHabit(userId: string, id: string): Promise<boolean> {
  if (!await getHabit(userId, id)) return false;
  await execute(`DELETE FROM habits WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/** Toggle a habit for a given date. Returns the updated habit. */
export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date = todayKey(),
  note = "",
): Promise<HabitWithStats | null> {
  const habit = await getHabit(userId, habitId);
  if (!habit) return null;
  const existing = await queryOne<LogRow>(
    `SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?`,
    [habitId, date],
  );
  if (existing) {
    await execute(`DELETE FROM habit_logs WHERE id = ?`, [existing.id]);
  } else {
    await execute(
      `INSERT INTO habit_logs (id, habit_id, user_id, log_date, completed, note, created_at)
       VALUES (?,?,?,?,1,?,?)`,
      [newId("hlg"), habitId, userId, date, note, nowIso()],
    );
  }
  return await getHabit(userId, habitId);
}

export async function listLogs(userId: string, habitId: string, limit = 60): Promise<HabitLog[]> {
  return (await query<LogRow>(
    `SELECT * FROM habit_logs WHERE user_id = ? AND habit_id = ? ORDER BY log_date DESC LIMIT ?`,
    [userId, habitId, limit],
  )).map(mapLog);
}

export interface HabitSummary {
  totalHabits: number;
  completedToday: number;
  dueToday: number;
  bestStreak: number;
  weeklyAdherence: number;
}

export async function habitSummary(userId: string): Promise<HabitSummary> {
  const habits = await listHabits(userId);
  const dueToday = habits.filter((h) => {
    if (h.cadence === "daily") return true;
    if (h.cadence === "weekdays") {
      const d = new Date().getDay();
      return d >= 1 && d <= 5;
    }
    return h.completionsThisWeek < h.targetPerWeek;
  });
  const completed = habits.filter((h) => h.completedToday).length;
  const adherence = habits.length
    ? Math.round(habits.reduce((a, h) => a + h.adherence, 0) / habits.length)
    : 0;
  return {
    totalHabits: habits.length,
    completedToday: completed,
    dueToday: dueToday.length,
    bestStreak: habits.reduce((a, h) => Math.max(a, h.currentStreak), 0),
    weeklyAdherence: adherence,
  };
}
