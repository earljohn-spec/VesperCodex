import "server-only";
import { execute, newId, nowIso, query, queryOne } from "../db";
import type { Intervention, InterventionKind, InterventionStatus } from "../types";

interface Row {
  id: string;
  user_id: string;
  biometric_id: string | null;
  kind: string;
  title: string;
  detail: string;
  duration_sec: number;
  trigger_note: string;
  status: string;
  triggered_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function map(r: Row): Intervention {
  return {
    id: r.id,
    userId: r.user_id,
    biometricId: r.biometric_id,
    kind: r.kind as InterventionKind,
    title: r.title,
    detail: r.detail,
    durationSec: r.duration_sec,
    triggerNote: r.trigger_note,
    status: r.status as InterventionStatus,
    triggeredAt: r.triggered_at,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listInterventions(
  userId: string,
  opts: { status?: string; limit?: number } = {},
): Promise<Intervention[]> {
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (opts.status && opts.status !== "all") {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  return (await query<Row>(
    `SELECT * FROM interventions WHERE ${clauses.join(" AND ")} ORDER BY triggered_at DESC LIMIT ?`,
    [...params, opts.limit ?? 100],
  )).map(map);
}

export async function activeInterventions(userId: string): Promise<Intervention[]> {
  return (await query<Row>(
    `SELECT * FROM interventions WHERE user_id = ? AND status IN ('suggested','snoozed')
     ORDER BY triggered_at DESC LIMIT 10`,
    [userId],
  )).map(map);
}

export async function getIntervention(userId: string, id: string): Promise<Intervention | null> {
  const r = await queryOne<Row>(`SELECT * FROM interventions WHERE id = ? AND user_id = ?`, [id, userId]);
  return r ? map(r) : null;
}

export interface InterventionInput {
  kind: InterventionKind;
  title: string;
  detail?: string;
  durationSec?: number;
  triggerNote?: string;
  biometricId?: string | null;
  status?: InterventionStatus;
  triggeredAt?: string;
}

export async function createIntervention(userId: string, input: InterventionInput): Promise<Intervention> {
  const id = newId("int");
  const ts = nowIso();
  await execute(
    `INSERT INTO interventions (id, user_id, biometric_id, kind, title, detail, duration_sec, trigger_note, status, triggered_at, resolved_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
    [
      id,
      userId,
      input.biometricId ?? null,
      input.kind,
      input.title.trim(),
      input.detail?.trim() ?? "",
      input.durationSec ?? 120,
      input.triggerNote?.trim() ?? "",
      input.status ?? "suggested",
      input.triggeredAt ?? ts,
      ts,
      ts,
    ],
  );
  return (await getIntervention(userId, id))!;
}

export async function updateIntervention(
  userId: string,
  id: string,
  input: Partial<InterventionInput>,
): Promise<Intervention | null> {
  if (!await getIntervention(userId, id)) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    params.push(v);
  };
  if (input.kind !== undefined) push("kind", input.kind);
  if (input.title !== undefined) push("title", input.title.trim());
  if (input.detail !== undefined) push("detail", input.detail.trim());
  if (input.durationSec !== undefined) push("duration_sec", input.durationSec);
  if (input.triggerNote !== undefined) push("trigger_note", input.triggerNote.trim());
  if (input.status !== undefined) {
    push("status", input.status);
    push("resolved_at", input.status === "suggested" ? null : nowIso());
  }
  push("updated_at", nowIso());
  await execute(`UPDATE interventions SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return await getIntervention(userId, id);
}

export async function deleteIntervention(userId: string, id: string): Promise<boolean> {
  if (!await getIntervention(userId, id)) return false;
  await execute(`DELETE FROM interventions WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

export interface InterventionSummary {
  activeCount: number;
  completed7: number;
  completionRate: number;
  minutesReclaimed7: number;
  favoriteKind: string | null;
}

export async function interventionSummary(userId: string): Promise<InterventionSummary> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const active =
    (await queryOne<{ c: number }>(
      `SELECT COUNT(*) c FROM interventions WHERE user_id = ? AND status IN ('suggested','snoozed')`,
      [userId],
    ))?.c ?? 0;
  const completed =
    await queryOne<{ c: number; s: number | null }>(
      `SELECT COUNT(*) c, SUM(duration_sec) s FROM interventions
       WHERE user_id = ? AND status = 'completed' AND triggered_at >= ?`,
      [userId, since],
    ) ?? { c: 0, s: 0 };
  const total =
    (await queryOne<{ c: number }>(
      `SELECT COUNT(*) c FROM interventions WHERE user_id = ? AND triggered_at >= ?`,
      [userId, since],
    ))?.c ?? 0;
  const fav = await queryOne<{ kind: string }>(
    `SELECT kind FROM interventions WHERE user_id = ? AND status = 'completed'
     GROUP BY kind ORDER BY COUNT(*) DESC LIMIT 1`,
    [userId],
  );
  return {
    activeCount: active,
    completed7: completed.c,
    completionRate: total ? Math.round((completed.c / total) * 100) : 0,
    minutesReclaimed7: Math.round((completed.s ?? 0) / 60),
    favoriteKind: fav?.kind ?? null,
  };
}

/* ---------------------- micro-break recommendation ---------------------- */

export const BREAK_LIBRARY: Record<
  InterventionKind,
  { title: string; detail: string; durationSec: number }[]
> = {
  breathing: [
    {
      title: "Box breathing · 4-4-4-4",
      detail:
        "Inhale 4, hold 4, exhale 4, hold 4. Six rounds. Steadies the vagal brake and pulls heart rate back down within two minutes.",
      durationSec: 120,
    },
    {
      title: "Physiological sigh ×5",
      detail:
        "Double inhale through the nose, long slow exhale through the mouth. Fastest known way to offload CO₂ and drop arousal.",
      durationSec: 90,
    },
    {
      title: "4-7-8 downshift",
      detail: "Inhale 4, hold 7, exhale 8. Four rounds. Best right before a hard meeting or sleep.",
      durationSec: 150,
    },
  ],
  micro_break: [
    {
      title: "Screen-free 3 minutes",
      detail:
        "Stand up, look at something more than 20 feet away, let your eyes unfocus. No phone. Resets attention residue between tasks.",
      durationSec: 180,
    },
    {
      title: "Tea ritual pause",
      detail: "Make a drink with full attention on the sound, warmth, and smell. Nothing else.",
      durationSec: 300,
    },
  ],
  grounding: [
    {
      title: "5-4-3-2-1 senses",
      detail:
        "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste. Interrupts spiralling thought loops.",
      durationSec: 180,
    },
    {
      title: "Feet-on-floor scan",
      detail:
        "Press both feet down, scan from soles to shoulders, release each area on the exhale.",
      durationSec: 120,
    },
  ],
  movement: [
    {
      title: "Two-minute shoulder reset",
      detail:
        "Ten slow shoulder rolls back, doorway chest stretch 30s each side. Undoes the desk hunch that feeds shallow breathing.",
      durationSec: 120,
    },
    {
      title: "Stair walk",
      detail: "One flight up and down at an easy pace. Burns off circulating adrenaline.",
      durationSec: 240,
    },
  ],
  reflection: [
    {
      title: "Name it to tame it",
      detail:
        "One sentence: what am I feeling and what does it want? Labelling an emotion measurably reduces amygdala activation.",
      durationSec: 120,
    },
    {
      title: "Close-the-loop note",
      detail: "Write the one open loop making you tense, plus the next single action for it.",
      durationSec: 180,
    },
  ],
};

export function recommendBreak(stressIndex: number, hrvDelta: number): InterventionInput {
  let kind: InterventionKind = "breathing";
  if (stressIndex >= 78) kind = "breathing";
  else if (stressIndex >= 65) kind = hrvDelta < -8 ? "breathing" : "grounding";
  else if (stressIndex >= 50) kind = "movement";
  else kind = "micro_break";

  const options = BREAK_LIBRARY[kind];
  const pick = options[Math.floor(Math.random() * options.length)];
  return {
    kind,
    title: pick.title,
    detail: pick.detail,
    durationSec: pick.durationSec,
    triggerNote:
      stressIndex >= 65
        ? `Stress index ${stressIndex}/100 with HRV ${hrvDelta.toFixed(0)}ms vs baseline`
        : `Proactive reset · stress ${stressIndex}/100`,
  };
}
