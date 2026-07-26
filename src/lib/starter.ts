import "server-only";
import { execute, newId, nowIso } from "./db";

/**
 * New accounts shouldn't land in a void. This gives them a small, honest
 * starting point: three starter habits, one welcome conversation, and a
 * simulated wearable so the biometrics screen has something to show — all
 * clearly *their* data from minute one, with no fabricated history.
 */
export function seedStarterContent(userId: string, name: string) {
  const ts = nowIso();
  const firstName = name.split(" ")[0] || "there";

  const habits = [
    {
      name: "Morning walk",
      description: "20 minutes outside before opening the laptop.",
      icon: "footprints",
      color: "emerald",
      cadence: "daily",
      target: 7,
      reminder: "07:30",
    },
    {
      name: "Box breathing",
      description: "Two minutes, 4-4-4-4. Before your first meeting.",
      icon: "wind",
      color: "sky",
      cadence: "daily",
      target: 7,
      reminder: "08:45",
    },
    {
      name: "Evening journal",
      description: "Two lines minimum. A voice note counts.",
      icon: "notebook-pen",
      color: "violet",
      cadence: "daily",
      target: 7,
      reminder: "21:30",
    },
  ];

  for (const h of habits) {
    execute(
      `INSERT INTO habits (id, user_id, name, description, icon, color, cadence, target_per_week, reminder_time, archived, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`,
      [newId("hab"), userId, h.name, h.description, h.icon, h.color, h.cadence, h.target, h.reminder, ts, ts],
    );
  }

  const deviceId = newId("dev");
  execute(
    `INSERT INTO devices (id, user_id, provider, display_name, status, battery, last_sync_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [deviceId, userId, "apple_watch", "Apple Watch (simulated)", "connected", 84, ts, ts, ts],
  );

  // A short, believable baseline so the biometrics view isn't empty on day one.
  const now = Date.now();
  for (let i = 8; i >= 0; i--) {
    const at = new Date(now - i * 90 * 60_000);
    const hrv = 54 + Math.sin(i / 2) * 7 + (Math.random() * 5 - 2.5);
    const restingHr = 58;
    const hr = Math.round(restingHr + Math.max(0, Math.sin(i / 1.7) * 12) + Math.random() * 5);
    const respiration = 13 + Math.max(0, Math.sin(i / 1.7) * 2);
    let stress = Math.max(0, Math.min(55, (1 - hrv / 58) * 110));
    stress += Math.max(0, Math.min(30, (hr - restingHr) * 0.9));
    stress += Math.max(0, Math.min(15, (respiration - 13) * 3));
    execute(
      `INSERT INTO biometrics (id, user_id, device_id, recorded_at, hrv, resting_hr, heart_rate, respiration, sleep_hours, steps, stress_index, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId("bio"),
        userId,
        deviceId,
        at.toISOString(),
        +hrv.toFixed(1),
        restingHr,
        hr,
        +respiration.toFixed(1),
        i === 8 ? 7.1 : null,
        Math.round(600 * (9 - i)),
        Math.round(stress),
        at.toISOString(),
      ],
    );
  }

  const convId = newId("cnv");
  execute(
    `INSERT INTO conversations (id, user_id, title, summary, pinned, archived, created_at, updated_at)
     VALUES (?,?,?,?,0,0,?,?)`,
    [convId, userId, "Getting started", "First conversation with Vesper.", ts, ts],
  );
  execute(
    `INSERT INTO messages (id, conversation_id, user_id, role, content, strategy, context_used, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      newId("msg"),
      convId,
      userId,
      "assistant",
      `Hi ${firstName} — I'm Vesper.\n\nI work best once I know a bit about your patterns, so the first week is mostly me listening. Log a mood entry when you think of it, tick off a habit or two, and I'll start noticing things: which hours drain you, what actually helps, when your body tenses up before you consciously notice.\n\nNo streak guilt here. Miss a day and nothing breaks.\n\nWhat's going on for you at the moment?`,
      "Onboarding",
      "[]",
      ts,
    ],
  );

  execute(
    `INSERT INTO memories (id, user_id, kind, label, detail, weight, last_seen_at, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      newId("mem"),
      userId,
      "milestone",
      "joined Vesper",
      "Started using Vesper. Baseline still being established.",
      1,
      ts,
      ts,
    ],
  );
}
