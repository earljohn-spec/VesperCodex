/**
 * Seeds Vesper with a realistic 60-day history for the demo account.
 *
 * The data is deliberately *narrative*: Maya is a product lead sliding into
 * burnout around a launch, hitting a low point ~3 weeks ago, then slowly
 * recovering as breathing breaks and boundaries start landing. Mood, HRV,
 * sleep, habits, and conversations all reflect the same arc so every chart
 * tells a consistent story.
 */
import "./_shim";
import { scryptSync, randomBytes } from "node:crypto";
import { execute, query, driver } from "../src/lib/db";


/* --------------------------- deterministic RNG -------------------------- */
let seedState = 20260726;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function between(min: number, max: number) {
  return min + rnd() * (max - min);
}
function intBetween(min: number, max: number) {
  return Math.floor(between(min, max + 1));
}
function choice<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function chance(p: number) {
  return rnd() < p;
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/* ------------------------------ narrative -------------------------------- */

const DAYS = 60;

/** Mood arc: fine → decline into launch → trough ~day 21 → recovery. */
function moodForDay(ago: number): number {
  const t = DAYS - ago; // 0..60 forward in time
  let base: number;
  if (t < 15) base = 6.9 - t * 0.055; // gentle slide
  else if (t < 32) base = 6.1 - (t - 15) * 0.115; // steeper into the launch
  else if (t < 40) base = 4.15 + (t - 32) * 0.075; // trough, slow lift
  else base = 4.75 + (t - 40) * 0.105; // recovery
  const dow = daysAgo(ago).getDay();
  const weekendLift = dow === 0 || dow === 6 ? 0.75 : 0;
  const mondayDip = dow === 1 ? -0.55 : 0;
  return Math.max(1, Math.min(10, base + weekendLift + mondayDip + between(-0.65, 0.65)));
}

function hrvForMood(mood: number) {
  return Math.max(18, Math.min(95, 30 + mood * 4.4 + between(-6, 6)));
}

const JOURNAL_TEMPLATES: {
  match: (mood: number, dow: number) => boolean;
  title: string;
  body: string;
  emotions: string[];
}[] = [
  {
    match: (m) => m < 3.6,
    title: "Nothing left in the tank",
    body: "Woke up already behind. Sat in the car in the parking garage for eleven minutes because I couldn't make myself walk in. Didn't eat lunch again. I keep telling myself it's just until the launch but I said that about the last one too. The worst part is I can't tell if I'm tired or if this is something else.",
    emotions: ["overwhelmed", "numb", "tired"],
  },
  {
    match: (m) => m < 3.6,
    title: "Snapped at Dan",
    body: "Over a Figma comment. A *comment*. Apologised straight after and he was fine about it which somehow made it worse. That's not who I want to be at work. Went for a walk around the block afterwards and my hands were shaking.",
    emotions: ["frustrated", "overwhelmed", "sad"],
  },
  {
    match: (m) => m >= 3.6 && m < 5,
    title: "Running on fumes",
    body: "Back-to-back from 9 to 4, ate at my desk, still ended the day with the same list I started with. The 3pm slot is brutal — that's when I can feel my patience go. Managed a short walk at lunch which helped more than I expected.",
    emotions: ["tired", "anxious", "restless"],
  },
  {
    match: (m) => m >= 3.6 && m < 5,
    title: "Couldn't switch off",
    body: "Lay awake until 1:30 rehearsing the steering meeting. Nothing new came out of it, my brain just kept re-running the same slide. Tried the breathing thing at 12:40 and it did actually slow things down, took maybe fifteen minutes to work.",
    emotions: ["anxious", "restless", "tired"],
  },
  {
    match: (m) => m >= 5 && m < 6.5,
    title: "Neutral day, and that's fine",
    body: "Not much to report, which is its own kind of progress. Got through the roadmap review without my chest tightening. Left the laptop at the office. Made actual dinner instead of cereal.",
    emotions: ["calm", "tired", "content"],
  },
  {
    match: (m) => m >= 5 && m < 6.5,
    title: "Said no to something",
    body: "Declined the Thursday sync — offered async notes instead and nobody died. Felt disproportionately guilty for about an hour and then genuinely relieved. Worth remembering how small the actual consequence was.",
    emotions: ["relieved", "proud", "anxious"],
  },
  {
    match: (m) => m >= 6.5,
    title: "A properly good one",
    body: "Slept nearly eight hours and could feel the difference before I'd even had coffee. Ran in the morning, shipped the thing, had lunch away from the desk with Priya. This is what the baseline is supposed to feel like. Noting it so I remember it's reachable.",
    emotions: ["energized", "grateful", "proud"],
  },
  {
    match: (m) => m >= 6.5,
    title: "Sunday reset",
    body: "No laptop all day. Long walk, farmers market, cooked properly, read on the sofa for two hours. Phone in a drawer from 4pm. I notice these days are the only ones where my jaw isn't tight.",
    emotions: ["calm", "content", "grateful"],
  },
  {
    match: (m, d) => d === 1,
    title: "Monday reentry",
    body: "The gap between Sunday evening and Monday morning is the steepest drop in my week and I don't think that's a coincidence. Blocked out the first hour tomorrow — no meetings before 10.",
    emotions: ["anxious", "restless"],
  },
];

const VOICE_TEMPLATES = [
  {
    title: "Voice note · walking home",
    body: "Just leaving the office. Um — honestly the day was fine, it's more that I haven't had a single stretch longer than twenty minutes to actually think. I think that's the thing that's wearing me down, not the workload itself. The fragmentation. Anyway. Walking helps.",
    emotions: ["tired", "restless"],
  },
  {
    title: "Voice note · car park, before the review",
    body: "Okay, five minutes before the steering review. Heart's going. Doing the four-four-four thing now... right. I know from last time that I always think it went badly and then it doesn't. Just — say the number, don't apologise for it, and stop talking when you're done.",
    emotions: ["anxious", "focused"],
  },
  {
    title: "Voice note · Saturday morning",
    body: "Slept in until half eight which never happens. Feel like a person again. Going to keep the phone off until lunch and see how that goes.",
    emotions: ["calm", "hopeful", "content"],
  },
  {
    title: "Voice note · post-run",
    body: "Just got back, did the loop by the reservoir. Legs are dead but my head is the clearest it's been all week. Note to self: this is non-negotiable, it's not the thing to cut when it's busy, it's the thing that makes busy survivable.",
    emotions: ["energized", "proud", "hopeful"],
  },
  {
    title: "Voice note · 11pm, can't sleep",
    body: "Third night this week. It's not even anxious thoughts exactly, it's just... loud in there. Going to try writing the open loops down and see if that offloads it.",
    emotions: ["restless", "tired", "anxious"],
  },
];

/* --------------------------------- run ----------------------------------- */

async function main() {

  const email = "maya@vesper.app";

  // Wipe any prior demo user so the seed is idempotent.
  const existing = (await query(`SELECT id FROM users WHERE email = ?`, [email]))[0] as
    | { id: string }
    | undefined;
  if (existing) {
    await execute(`DELETE FROM users WHERE id = ?`, [existing.id]);
    console.log("· cleared previous demo account");
  }

  const userId = id("usr");
  const now = new Date().toISOString();
  const createdAt = daysAgo(DAYS + 4).toISOString();

  await execute(`INSERT INTO users (id, email, name, password_hash, avatar_hue, timezone, focus_areas, onboarded, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,1,?,?)`, [userId,
    email,
    "Maya Okonkwo",
    hashPassword("wellness123"),
    268,
    "Europe/London",
    JSON.stringify(["burnout recovery", "sleep", "boundaries at work"]),
    createdAt,
    now,]);
  console.log("✓ demo user  maya@vesper.app / wellness123");

  /* ------------------------------ devices ------------------------------- */
  const appleWatch = id("dev");
  const fitbit = id("dev");
  const oura = id("dev");
  const devices = [
    [appleWatch, "apple_watch", "Maya's Apple Watch Series 9", "connected", 72, daysAgo(0, new Date().getHours(), 0)],
    [fitbit, "fitbit", "Fitbit Charge 6", "connected", 41, daysAgo(0, Math.max(0, new Date().getHours() - 2))],
    [oura, "oura", "Oura Ring Gen 3", "paused", 88, daysAgo(6, 7)],
  ] as const;
  for (const [devId, provider, name, status, battery, sync] of devices) {
    await execute(`INSERT INTO devices (id, user_id, provider, display_name, status, battery, last_sync_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`, [devId, userId, provider, name, status, battery, sync.toISOString(), createdAt, now]);
  }
  console.log(`✓ ${devices.length} connected devices`);

  /* ------------------------------- habits ------------------------------- */
  const habitDefs = [
    {
      name: "Morning walk",
      description: "20 minutes outside before opening the laptop. Light exposure + movement.",
      icon: "footprints",
      color: "emerald",
      cadence: "daily",
      target: 7,
      reminder: "07:30",
      strength: 0.74,
    },
    {
      name: "Box breathing",
      description: "2 minutes, 4-4-4-4. Before the first meeting and any time HRV drops.",
      icon: "wind",
      color: "sky",
      cadence: "daily",
      target: 7,
      reminder: "08:45",
      strength: 0.83,
    },
    {
      name: "No laptop after 21:00",
      description: "Screens off, charger in the kitchen. Protects sleep onset.",
      icon: "moon",
      color: "indigo",
      cadence: "daily",
      target: 7,
      reminder: "20:45",
      strength: 0.52,
    },
    {
      name: "Lunch away from desk",
      description: "Eat somewhere that isn't in front of a screen.",
      icon: "utensils",
      color: "amber",
      cadence: "weekdays",
      target: 5,
      reminder: "12:30",
      strength: 0.44,
    },
    {
      name: "Strength session",
      description: "Three times a week, 35 minutes. Non-negotiable when busy.",
      icon: "dumbbell",
      color: "rose",
      cadence: "weekly",
      target: 3,
      reminder: null,
      strength: 0.61,
    },
    {
      name: "Evening journal",
      description: "Two lines minimum. Voice note counts.",
      icon: "notebook-pen",
      color: "violet",
      cadence: "daily",
      target: 7,
      reminder: "21:30",
      strength: 0.79,
    },
  ];

  const habitIds: Record<string, string> = {};
  for (const h of habitDefs) {
    const hid = id("hab");
    habitIds[h.name] = hid;
    await execute(`INSERT INTO habits (id, user_id, name, description, icon, color, cadence, target_per_week, reminder_time, archived, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`, [hid,
      userId,
      h.name,
      h.description,
      h.icon,
      h.color,
      h.cadence,
      h.target,
      h.reminder,
      createdAt,
      now,]);
  }
  // one archived habit, so the archive filter has something to show
  await execute(`INSERT INTO habits (id, user_id, name, description, icon, color, cadence, target_per_week, reminder_time, archived, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`, [id("hab"),
    userId,
    "Cold shower",
    "Tried it for three weeks. Made mornings worse, not better — parked it.",
    "droplets",
    "cyan",
    "daily",
    7,
    null,
    daysAgo(50).toISOString(),
    daysAgo(29).toISOString(),]);

  let logCount = 0;
  for (const h of habitDefs) {
    for (let ago = DAYS; ago >= 0; ago--) {
      const d = daysAgo(ago);
      const dow = d.getDay();
      if (h.cadence === "weekdays" && (dow === 0 || dow === 6)) continue;
      if (h.cadence === "weekly" && !(dow === 1 || dow === 3 || dow === 6)) continue;

      // adherence dips hard through the burnout trough, recovers after
      const t = DAYS - ago;
      let modifier = 1;
      if (t >= 15 && t < 34) modifier = 0.55;
      else if (t >= 34 && t < 44) modifier = 0.82;
      else if (t >= 44) modifier = 1.12;

      // don't complete today's habits all at once — leave some open
      if (ago === 0 && !["Box breathing", "Morning walk"].includes(h.name)) continue;

      if (chance(Math.min(0.97, h.strength * modifier))) {
        await execute(`INSERT OR IGNORE INTO habit_logs (id, habit_id, user_id, log_date, completed, note, created_at)
           VALUES (?,?,?,?,1,?,?)`, [id("hlg"), habitIds[h.name], userId, dateKey(d), "", d.toISOString()]);
        logCount++;
      }
    }
  }
  console.log(`✓ ${habitDefs.length + 1} habits, ${logCount} completion logs`);

  /* ------------------------------ journal ------------------------------- */
  let entryCount = 0;
  for (let ago = DAYS; ago >= 0; ago--) {
    const d = daysAgo(ago);
    const dow = d.getDay();
    const mood = moodForDay(ago);

    // ~78% of days have an entry, with a gap during the worst stretch
    const t = DAYS - ago;
    const writeChance = t >= 20 && t <= 26 ? 0.45 : 0.82;
    if (!chance(writeChance)) continue;

    const isVoice = chance(0.32);
    const hour = isVoice ? intBetween(7, 22) : intBetween(19, 22);
    const entryDate = daysAgo(ago, hour, intBetween(0, 59));

    let title: string;
    let body: string;
    let emotions: string[];

    if (isVoice) {
      const tpl =
        mood < 4.5
          ? choice([VOICE_TEMPLATES[0], VOICE_TEMPLATES[1], VOICE_TEMPLATES[4]])
          : choice([VOICE_TEMPLATES[2], VOICE_TEMPLATES[3], VOICE_TEMPLATES[0]]);
      title = tpl.title;
      body = tpl.body;
      emotions = tpl.emotions;
    } else {
      const candidates = JOURNAL_TEMPLATES.filter((tpl) => tpl.match(mood, dow));
      const tpl = candidates.length ? choice(candidates) : JOURNAL_TEMPLATES[4];
      title = tpl.title;
      body = tpl.body;
      emotions = tpl.emotions;
    }

    const energy = Math.max(1, Math.min(10, mood + between(-1.4, 1.0)));
    // a couple of recent entries are captured offline and still pending sync
    const pending = ago <= 2 && chance(0.3);

    await execute(`INSERT INTO journal_entries
        (id, user_id, title, body, mood_score, energy_score, emotions, source, transcript_ms, entry_date, created_at, updated_at, synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id("jrn"),
      userId,
      title,
      body,
      Math.round(mood),
      Math.round(energy),
      JSON.stringify(emotions),
      isVoice ? "voice" : "text",
      isVoice ? intBetween(28_000, 145_000) : null,
      entryDate.toISOString(),
      entryDate.toISOString(),
      entryDate.toISOString(),
      pending ? 0 : 1,]);
    entryCount++;
  }
  console.log(`✓ ${entryCount} journal entries (60-day mood arc)`);

  /* ----------------------------- biometrics ----------------------------- */
  //
  // Samples are generated every 2h. For *today* we anchor to the current
  // clock so the dashboard always has fresh data no matter when the seed
  // runs, and we plant a live stress spike in the last ~30 minutes so the
  // biometric feature has something real to react to on first load.
  //
  const BASELINE_HRV = 58;

  async function insertSample(opts: {
    recordedAt: Date;
    hrv: number;
    restingHr: number;
    hr: number;
    respiration: number;
    sleep?: number | null;
    steps?: number | null;
  }) {
    let stress = Math.max(0, Math.min(55, (1 - opts.hrv / BASELINE_HRV) * 110));
    stress += Math.max(0, Math.min(30, (opts.hr - opts.restingHr) * 0.9));
    stress += Math.max(0, Math.min(15, (opts.respiration - 13) * 3));
    stress = Math.round(Math.max(0, Math.min(100, stress)));

    await execute(`INSERT INTO biometrics (id, user_id, device_id, recorded_at, hrv, resting_hr, heart_rate, respiration, sleep_hours, steps, stress_index, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id("bio"),
      userId,
      chance(0.75) ? appleWatch : fitbit,
      opts.recordedAt.toISOString(),
      +opts.hrv.toFixed(1),
      opts.restingHr,
      opts.hr,
      +opts.respiration.toFixed(1),
      opts.sleep ?? null,
      opts.steps ?? null,
      stress,
      opts.recordedAt.toISOString(),]);
    return stress;
  }

  let bioCount = 0;
  const SAMPLE_HOURS = [7, 9, 11, 13, 15, 17, 19, 21, 23];

  for (let ago = DAYS; ago >= 1; ago--) {
    const mood = moodForDay(ago);
    const dayHrv = hrvForMood(mood);
    const restingHr = Math.round(between(52, 60) + (7 - mood) * 1.6);
    const sleep = Math.max(3.8, Math.min(9.2, 5.2 + mood * 0.35 + between(-0.8, 0.8)));

    for (const hour of SAMPLE_HOURS) {
      const recordedAt = daysAgo(ago, hour, intBetween(0, 55));
      // intraday shape: dips during the mid-morning and mid-afternoon blocks
      const meetingLoad = hour === 11 || hour === 15 ? 1 : hour === 9 || hour === 13 ? 0.55 : 0;
      await insertSample({
        recordedAt,
        hrv: Math.max(14, dayHrv - meetingLoad * between(9, 18) + between(-4, 4)),
        restingHr,
        hr: Math.round(restingHr + meetingLoad * between(14, 30) + between(-3, 8)),
        respiration: 12.5 + meetingLoad * between(1.5, 4) + between(-0.8, 0.8),
        sleep: hour === 7 ? +sleep.toFixed(1) : null,
        steps: hour === 7 ? intBetween(400, 1400) : Math.round(between(800, 1500) * (hour - 6)),
      });
      bioCount++;
    }
  }

  // ---- today, anchored to the current time ----
  const todayMood = moodForDay(0);
  const todayHrv = hrvForMood(todayMood);
  const todayResting = Math.round(between(52, 58));
  const todaySleep = +Math.max(5.5, Math.min(8.6, 5.2 + todayMood * 0.35 + between(-0.4, 0.6))).toFixed(1);
  const nowDate = new Date();

  // wake-up sample carries last night's sleep
  const wake = new Date(nowDate);
  wake.setHours(7, 12, 0, 0);
  if (wake.getTime() < nowDate.getTime()) {
    await insertSample({
      recordedAt: wake,
      hrv: todayHrv + between(2, 6),
      restingHr: todayResting,
      hr: todayResting + intBetween(2, 6),
      respiration: 12.4,
      sleep: todaySleep,
      steps: intBetween(300, 900),
    });
    bioCount++;
  }

  // every 2 hours from wake up to ~40 minutes ago
  let cursor = new Date(Math.max(wake.getTime(), nowDate.getTime() - 14 * 3600_000));
  cursor = new Date(cursor.getTime() + 2 * 3600_000);
  let cumulativeSteps = 900;
  while (cursor.getTime() < nowDate.getTime() - 40 * 60_000) {
    const h = cursor.getHours();
    const meetingLoad = h === 11 || h === 15 ? 1 : h === 9 || h === 13 ? 0.55 : 0.15;
    cumulativeSteps += intBetween(300, 1100);
    await insertSample({
      recordedAt: new Date(cursor),
      hrv: Math.max(16, todayHrv - meetingLoad * between(8, 16) + between(-3, 3)),
      restingHr: todayResting,
      hr: Math.round(todayResting + meetingLoad * between(12, 26) + between(-2, 6)),
      respiration: 12.5 + meetingLoad * between(1.2, 3.4) + between(-0.5, 0.5),
      steps: cumulativeSteps,
    });
    bioCount++;
    cursor = new Date(cursor.getTime() + 2 * 3600_000);
  }

  // ---- live stress spike in the last 30 minutes ----
  // This is what the "suggested" micro-break on the dashboard is reacting to.
  const spikeSamples = [
    { minsAgo: 28, hrvDrop: 12, hrLift: 19, resp: 15.6 },
    { minsAgo: 14, hrvDrop: 17, hrLift: 24, resp: 16.4 },
    { minsAgo: 4, hrvDrop: 15, hrLift: 21, resp: 15.9 },
  ];
  let liveStress = 0;
  for (const s of spikeSamples) {
    cumulativeSteps += intBetween(10, 90);
    liveStress = await insertSample({
      recordedAt: new Date(nowDate.getTime() - s.minsAgo * 60_000),
      hrv: Math.max(15, todayHrv - s.hrvDrop),
      restingHr: todayResting,
      hr: todayResting + s.hrLift,
      respiration: s.resp,
      steps: cumulativeSteps,
    });
    bioCount++;
  }
  console.log(`✓ ${bioCount} biometric samples (live stress index ${liveStress}/100)`);

  /* ---------------------------- interventions --------------------------- */
  const breakLib = [
    ["breathing", "Box breathing · 4-4-4-4", "Inhale 4, hold 4, exhale 4, hold 4. Six rounds.", 120],
    ["breathing", "Physiological sigh ×5", "Double inhale through the nose, long slow exhale.", 90],
    ["grounding", "5-4-3-2-1 senses", "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.", 180],
    ["movement", "Two-minute shoulder reset", "Ten slow shoulder rolls, doorway chest stretch 30s each side.", 120],
    ["micro_break", "Screen-free 3 minutes", "Stand up, look 20 feet away, let your eyes unfocus. No phone.", 180],
    ["reflection", "Name it to tame it", "One sentence: what am I feeling and what does it want?", 120],
  ] as const;

  let intCount = 0;
  for (let ago = DAYS; ago >= 0; ago--) {
    const mood = moodForDay(ago);
    const spikes = mood < 4.5 ? intBetween(1, 3) : mood < 6 ? intBetween(0, 2) : intBetween(0, 1);
    for (let s = 0; s < spikes; s++) {
      const [kind, title, detail, duration] = choice([...breakLib]);
      const hour = choice([9, 11, 13, 15, 16, 17]);
      const triggered = daysAgo(ago, hour, intBetween(0, 55));
      const stress = intBetween(62, 92);
      // completion rate improves over the recovery arc
      const t = DAYS - ago;
      const completeChance = t < 20 ? 0.45 : t < 34 ? 0.3 : 0.72;
      // Everything older than yesterday is fully resolved — a 6-week-old
      // "snoozed" break should not still be counted as needing attention.
      const status = chance(completeChance)
        ? "completed"
        : ago <= 1 && chance(0.35)
          ? "snoozed"
          : "dismissed";
      await execute(`INSERT INTO interventions (id, user_id, biometric_id, kind, title, detail, duration_sec, trigger_note, status, triggered_at, resolved_at, created_at, updated_at)
         VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,?)`, [id("int"),
        userId,
        kind,
        title,
        detail,
        duration,
        `Stress index ${stress}/100 · HRV ${(hrvForMood(mood) - 58).toFixed(0)}ms vs baseline`,
        status,
        triggered.toISOString(),
        new Date(triggered.getTime() + duration * 1000).toISOString(),
        triggered.toISOString(),
        triggered.toISOString(),]);
      intCount++;
    }
  }

  // The one live suggestion — reacting to the stress spike seeded above.
  const spikeAt = new Date(Date.now() - 11 * 60_000);
  await execute(`INSERT INTO interventions (id, user_id, biometric_id, kind, title, detail, duration_sec, trigger_note, status, triggered_at, resolved_at, created_at, updated_at)
     VALUES (?,?,NULL,?,?,?,?,?,'suggested',?,NULL,?,?)`, [id("int"),
    userId,
    "breathing",
    "Box breathing · 4-4-4-4",
    "Inhale 4, hold 4, exhale 4, hold 4. Six rounds. Steadies the vagal brake and pulls heart rate back down within two minutes.",
    120,
    `Stress index ${liveStress}/100 — HRV dropped 17ms in the last half hour`,
    spikeAt.toISOString(),
    spikeAt.toISOString(),
    now,]);
  intCount++;
  console.log(`✓ ${intCount} micro-break interventions`);

  /* ------------------------------ memories ------------------------------ */
  const memories = [
    ["trigger", "steering review pressure", "Mood and HRV both drop the day before the monthly steering review. Consistent across three cycles.", 3.4],
    ["trigger", "3pm meeting block", "Stress index peaks between 15:00-16:30 on days with more than four meetings.", 2.9],
    ["strategy", "walking helps", "20-minute walks reliably lift mood by ~1.4 points same-day. Her most effective single lever.", 4.2],
    ["strategy", "box breathing helps", "Used before high-stakes meetings. Reports it takes ~15 min to feel the effect at night.", 3.1],
    ["strategy", "writing open loops helps", "Offloading unfinished tasks to paper reduces 11pm rumination.", 2.2],
    ["preference", "prefers direct over gentle", "Asked early on not to be 'handled'. Responds better to plain naming than reassurance.", 3.8],
    ["preference", "no morning notifications", "Wants the first hour of the day protected — no nudges before 09:00.", 2.0],
    ["person", "talks about partner", "Sam. Main source of support; Maya tends to under-share with them when stressed.", 2.6],
    ["person", "talks about therapist", "Sees Ruth fortnightly on Thursdays. Vesper is a supplement, not a replacement.", 3.0],
    ["milestone", "said no to Thursday sync", "First boundary set at work in months. Worth referencing when confidence dips.", 2.4],
    ["milestone", "14-day breathing streak", "Longest consistency run so far; happened during the recovery stretch.", 1.9],
  ] as const;
  for (const [kind, label, detail, weight] of memories) {
    await execute(`INSERT INTO memories (id, user_id, kind, label, detail, weight, last_seen_at, created_at)
       VALUES (?,?,?,?,?,?,?,?)`, [id("mem"),
      userId,
      kind,
      label,
      detail,
      weight,
      daysAgo(intBetween(0, 12)).toISOString(),
      daysAgo(intBetween(20, 55)).toISOString(),]);
  }
  console.log(`✓ ${memories.length} companion memories`);

  /* ---------------------------- conversations --------------------------- */
  const conversations: {
    title: string;
    summary: string;
    ago: number;
    pinned?: boolean;
    archived?: boolean;
    turns: [string, string, string | null][];
  }[] = [
    {
      title: "Pre-launch spiral",
      summary:
        "Launch week overwhelm. Landed on triaging the list A/B/C and protecting the first hour of the day.",
      ago: 24,
      pinned: true,
      turns: [
        [
          "user",
          "I have 40 open tabs in my head and the launch is Thursday. I don't know where to start and I've been staring at the same doc for an hour.",
          null,
        ],
        [
          "assistant",
          "That's not a focus problem, that's a capacity problem wearing a focus costume.\n\nYour HRV is 16ms under baseline right now and you've logged \"overwhelmed\" on four of the last five entries — your body has been flagging this before your calendar did.\n\nBefore the list: two minutes of box breathing. You can't triage from an activated nervous system. Then everything in your head goes on one page, and each item gets an **A** (only me, today), **B** (only me, not today), or **C** (someone else, or nobody). The doc you're staring at — is that actually an A?",
          "Downregulate first",
        ],
        ["user", "Honestly probably a B. Maybe even a C, Dan could do the first pass.", null],
        [
          "assistant",
          "Then that's an hour back, and more importantly it's evidence that the pile is smaller than it feels.\n\nHere's the pattern I want to flag: you did this before the last steering review too — the thing you were most stuck on turned out to be delegable. It's worth noticing that under load your first instinct is to absorb rather than distribute.\n\nWhat's the actual A on the list?",
          "Cognitive offload",
        ],
      ],
    },
    {
      title: "Can't sleep again",
      summary: "Third night of 1am rumination. Agreed to try open-loop dumping before bed + fixed wake time.",
      ago: 18,
      turns: [
        ["user", "Third night this week I've been awake past 1. Not even anxious exactly, just loud in there.", null],
        [
          "assistant",
          "\"Loud\" is a useful distinction — that's usually unfinished processing rather than anxiety, and it responds to different things.\n\nYou averaged 5.4 hours over the last four nights and your resting heart rate is up 6bpm, which is what short sleep does before you consciously feel it.\n\nTwo things. Tonight: write every open loop on paper before you get into bed — not a to-do list, just \"the thing my brain won't put down\" plus one next action for each. And this week, anchor your **wake** time rather than bedtime. Fixed wake is what rebuilds sleep pressure; fixed bedtime just gives you longer to lie there.\n\nWhich of those feels doable tonight?",
          "Sleep pressure reset",
        ],
        ["user", "The writing one. The wake time thing sounds miserable on a Saturday.", null],
        [
          "assistant",
          "Fair. Take the writing, skip the rest — one change that sticks beats two that don't.\n\nI'll note that you tend to negotiate down to exactly one thing and then actually do it, which is a better hit rate than most people get. Not a criticism.",
          "Behavioural experiment",
        ],
      ],
    },
    {
      title: "Snapped at a colleague",
      summary: "Guilt after an outburst. Reframed as a capacity signal; identified the 3pm block as the trigger window.",
      ago: 12,
      turns: [
        ["user", "I snapped at Dan over a Figma comment today. A comment. I feel awful.", null],
        [
          "assistant",
          "The guilt is doing its job — it means the behaviour was out of line with who you want to be, and you already know that. I'm not going to pile on.\n\nWhat I'd look at is the timing. Your stress index peaked at 84 between 3 and 4pm, which is the same window where this has happened before. That's four meetings deep with no break since 11.\n\nThat's not an excuse, it's a design fault. You've apologised. The more useful question is what stops the 3pm version of you from having to run the show at all — is there anything in that block that's actually movable?",
          "Somatic discharge",
        ],
      ],
    },
    {
      title: "Setting a boundary at work",
      summary: "Declined a recurring sync. Framed the guilt as a predictable and temporary cost.",
      ago: 7,
      turns: [
        ["user", "I said no to the Thursday sync. Offered async notes instead. Feel weirdly guilty about it.", null],
        [
          "assistant",
          "That's the first boundary you've set at work since we started talking — worth marking properly rather than skating past.\n\nThe guilt is predictable and it's short-lived. What matters more is the data point: nothing broke. That's the thing to remember next time, because your default assumption is that the consequence will be bigger than it is.\n\nYou're getting an hour back every week. What are you going to actually do with it — because if it's unallocated it'll get eaten by Thursday afternoon.",
          "Boundary reinforcement",
        ],
        ["user", "Walk, probably. That's the thing that always helps.", null],
        [
          "assistant",
          "Good — and consistent with your own data. Your mood averages 1.4 points higher on days you walk in the morning. That's a bigger effect than anything else you've tried.\n\nI'll remember Thursday 2pm as walk time.",
          "Savouring",
        ],
      ],
    },
    {
      title: "Checking in after a good week",
      summary: "Recovery trend confirmed across mood, HRV, and habit adherence.",
      ago: 2,
      turns: [
        ["user", "Feel like I've turned a corner this week? Or I'm imagining it.", null],
        [
          "assistant",
          "You're not imagining it.\n\n**Mood** — 6.4/10 over seven days, up 1.3 from the week before. That's the biggest week-on-week lift in your two months here.\n\n**Body** — HRV back to 3ms above baseline after three weeks under it, and you've had two nights over 7.5 hours.\n\n**Habits** — box breathing is on a 14-day streak, morning walk at 86% adherence.\n\nThe honest caveat: recovery from a stretch like the last month isn't linear, and the first bad day after a good week tends to feel disproportionately like a relapse. It won't be. What do you want to protect first if things get busy again?",
          "Pattern review",
        ],
      ],
    },
    {
      title: "Old notes on caffeine",
      summary: "Archived — experimented with cutting afternoon coffee.",
      ago: 40,
      archived: true,
      turns: [
        ["user", "Does cutting coffee after noon actually do anything or is that a myth", null],
        [
          "assistant",
          "It's real, but the effect size depends on you. Caffeine's half-life is around 5-6 hours, so a 3pm coffee still has a quarter of it circulating at midnight.\n\nYour sleep onset has been the weak link rather than total duration, and that's exactly the part caffeine hits hardest. Worth a ten-day test — keep the morning ones, cut anything after 12, and we'll compare against your HRV overnight numbers.\n\nWant me to check back on this in ten days?",
          "Behavioural experiment",
        ],
      ],
    },
  ];

  let msgCount = 0;
  for (const conv of conversations) {
    const cid = id("cnv");
    const start = daysAgo(conv.ago, intBetween(9, 21), intBetween(0, 59));
    await execute(`INSERT INTO conversations (id, user_id, title, summary, pinned, archived, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`, [cid,
      userId,
      conv.title,
      conv.summary,
      conv.pinned ? 1 : 0,
      conv.archived ? 1 : 0,
      start.toISOString(),
      new Date(start.getTime() + conv.turns.length * 90_000).toISOString(),]);
    for (const [i, [role, content, strategy]] of conv.turns.entries()) {
      await execute(`INSERT INTO messages (id, conversation_id, user_id, role, content, strategy, context_used, created_at)
         VALUES (?,?,?,?,?,?,?,?)`, [id("msg"),
        cid,
        userId,
        role,
        content,
        strategy,
        JSON.stringify(role === "assistant" ? ["mood-trend", "biometrics"] : []),
        new Date(start.getTime() + i * 90_000).toISOString(),]);
      msgCount++;
    }
  }
  console.log(`✓ ${conversations.length} conversations, ${msgCount} messages`);

  /* ----------------------------- sync events ---------------------------- */
  const syncEvents = [
    ["journal_entry", "create", "synced", 0.2],
    ["habit_log", "toggle", "synced", 0.6],
    ["biometric", "batch_import", "synced", 1.1],
    ["journal_entry", "create", "pending", 0.05],
    ["habit_log", "toggle", "pending", 0.02],
    ["intervention", "complete", "synced", 3.4],
    ["journal_entry", "update", "synced", 5.2],
    ["biometric", "batch_import", "failed", 8.1],
  ] as const;
  for (const [resource, action, status, hoursAgo] of syncEvents) {
    const at = new Date(Date.now() - hoursAgo * 3600_000);
    await execute(`INSERT INTO sync_events (id, user_id, resource, action, payload, status, created_at, synced_at)
       VALUES (?,?,?,?,?,?,?,?)`, [id("syn"),
      userId,
      resource,
      action,
      JSON.stringify({ source: chance(0.5) ? "apple_watch" : "app", offline: status === "pending" }),
      status,
      at.toISOString(),
      status === "synced" ? new Date(at.getTime() + 4000).toISOString() : null,]);
  }
  console.log(`✓ ${syncEvents.length} sync events`);

  
  console.log(`\n✨ Seed complete (${driver})`);
  console.log(`   Sign in with  maya@vesper.app  /  wellness123\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
