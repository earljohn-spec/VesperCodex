import "server-only";
import { execute, query, queryOne, transaction } from "./db";
import type { User } from "./types";

/**
 * Account self-service: export everything, or delete everything.
 *
 * Both are GDPR requirements (right to portability, right to erasure) and
 * both are things a wellness app should offer regardless of regulation —
 * people are more willing to journal honestly when leaving is easy.
 */

export interface ExportBundle {
  exportedAt: string;
  format: "vesper.export.v1";
  account: Omit<User, "id"> & { id: string };
  journalEntries: unknown[];
  habits: unknown[];
  habitLogs: unknown[];
  conversations: unknown[];
  messages: unknown[];
  memories: unknown[];
  devices: unknown[];
  biometrics: unknown[];
  interventions: unknown[];
  syncEvents: unknown[];
  counts: Record<string, number>;
}

/** Everything we hold about a user, as plain JSON. Password hash excluded. */
export async function exportAccount(user: User): Promise<ExportBundle> {
  const t = async <T,>(sql: string) => await query<T>(sql, [user.id]);

  const journalEntries = await t(`SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date`);
  const habits = await t(`SELECT * FROM habits WHERE user_id = ? ORDER BY created_at`);
  const habitLogs = await t(`SELECT * FROM habit_logs WHERE user_id = ? ORDER BY log_date`);
  const conversations = await t(`SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at`);
  const messages = await t(`SELECT * FROM messages WHERE user_id = ? ORDER BY created_at`);
  const memories = await t(`SELECT * FROM memories WHERE user_id = ? ORDER BY created_at`);
  const devices = await t(`SELECT * FROM devices WHERE user_id = ? ORDER BY created_at`);
  const biometrics = await t(`SELECT * FROM biometrics WHERE user_id = ? ORDER BY recorded_at`);
  const interventions = await t(`SELECT * FROM interventions WHERE user_id = ? ORDER BY triggered_at`);
  const syncEvents = await t(`SELECT * FROM sync_events WHERE user_id = ? ORDER BY created_at`);

  return {
    exportedAt: new Date().toISOString(),
    format: "vesper.export.v1",
    account: { ...user },
    journalEntries,
    habits,
    habitLogs,
    conversations,
    messages,
    memories,
    devices,
    biometrics,
    interventions,
    syncEvents,
    counts: {
      journalEntries: journalEntries.length,
      habits: habits.length,
      habitLogs: habitLogs.length,
      conversations: conversations.length,
      messages: messages.length,
      memories: memories.length,
      devices: devices.length,
      biometrics: biometrics.length,
      interventions: interventions.length,
      syncEvents: syncEvents.length,
    },
  };
}

export interface DeletionReport {
  deleted: true;
  removed: Record<string, number>;
}

/**
 * Hard-deletes the account. Child rows cascade via foreign keys, but we count
 * them first so the caller can show the user exactly what went, and we run it
 * in a transaction so a partial delete can't leave orphans.
 */
export async function deleteAccount(userId: string): Promise<DeletionReport> {
  const count = async (table: string) =>
    (await queryOne<{ c: number }>(`SELECT COUNT(*) c FROM ${table} WHERE user_id = ?`, [userId]))?.c ?? 0;

  const removed = {
    journalEntries: await count("journal_entries"),
    habits: await count("habits"),
    habitLogs: await count("habit_logs"),
    conversations: await count("conversations"),
    messages: await count("messages"),
    memories: await count("memories"),
    devices: await count("devices"),
    biometrics: await count("biometrics"),
    interventions: await count("interventions"),
    syncEvents: await count("sync_events"),
    sessions: await count("sessions"),
  };

  await transaction(async () => {
    // Explicit deletes rather than relying solely on cascade, so the intent is
    // readable and the behaviour is identical if foreign_keys is ever off.
    for (const table of [
      "habit_logs",
      "habits",
      "journal_entries",
      "messages",
      "conversations",
      "memories",
      "biometrics",
      "interventions",
      "devices",
      "sync_events",
      "sessions",
      "password_reset_tokens",
    ]) {
      await execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    }
    await execute(`DELETE FROM users WHERE id = ?`, [userId]);
  });

  return { deleted: true, removed };
}

/** Verifies the account is really gone — used by tests. */
export async function accountExists(userId: string): Promise<boolean> {
  return !!(await queryOne(`SELECT id FROM users WHERE id = ?`, [userId]));
}
