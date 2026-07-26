import "server-only";
import { listMemories, touchMemory, createMemory, listMessages } from "./repos/conversations";
import { journalStats, listEntries, emotionBreakdown, roughPatterns } from "./repos/journal";
import { biometricSummary } from "./repos/biometrics";
import { habitSummary, listHabits } from "./repos/habits";
import { BREAK_LIBRARY } from "./repos/interventions";
import type { Memory, Message, User } from "./types";

/**
 * Vesper's companion engine.
 *
 * The design goal is context-awareness, not eloquence for its own sake: every
 * reply must cite something true about *this* user — a mood trend, an HRV dip,
 * a habit streak, a strategy that worked before. Generic advice is the failure
 * mode we are explicitly designing against.
 *
 * If VESPER_LLM_API_KEY is configured the engine will delegate phrasing to an
 * OpenAI-compatible endpoint, passing the same grounded context block. Without
 * a key it runs fully offline with the local composer below — which is what
 * makes the demo work out of the box and keeps the offline promise honest.
 */

/* ----------------------------- context build ---------------------------- */

export interface CompanionContext {
  user: User;
  moodAvg7: number;
  moodDelta: number;
  streak: number;
  topEmotions: { emotion: string; count: number; positive: boolean }[];
  stressNow: number;
  hrvDelta: number;
  sleep: number | null;
  readiness: number;
  habitsDone: number;
  habitsDue: number;
  bestStreakHabit: { name: string; streak: number } | null;
  strugglingHabit: { name: string; adherence: number } | null;
  memories: Memory[];
  recentEntryExcerpt: string | null;
  recentEntryWhen: string | null;
  hardestHour: string | null;
}

export function buildContext(user: User): CompanionContext {
  const js = journalStats(user.id);
  const bio = biometricSummary(user.id);
  const hs = habitSummary(user.id);
  const habits = listHabits(user.id);
  const emotions = emotionBreakdown(user.id, 21).slice(0, 4);
  const entries = listEntries(user.id, { limit: 1 });
  const patterns = roughPatterns(user.id);

  const best = habits.reduce<{ name: string; streak: number } | null>(
    (acc, h) => (!acc || h.currentStreak > acc.streak ? { name: h.name, streak: h.currentStreak } : acc),
    null,
  );
  const struggling = habits
    .filter((h) => h.adherence < 55)
    .sort((a, b) => a.adherence - b.adherence)[0];

  return {
    user,
    moodAvg7: js.avgMood7,
    moodDelta: js.moodDelta,
    streak: js.streak,
    topEmotions: emotions,
    stressNow: bio.stressNow,
    hrvDelta: bio.hrvDelta,
    sleep: bio.sleepLastNight,
    readiness: bio.readiness,
    habitsDone: hs.completedToday,
    habitsDue: hs.dueToday,
    bestStreakHabit: best && best.streak > 0 ? best : null,
    strugglingHabit: struggling ? { name: struggling.name, adherence: struggling.adherence } : null,
    memories: listMemories(user.id).slice(0, 12),
    recentEntryExcerpt: entries[0]?.body?.slice(0, 220) ?? null,
    recentEntryWhen: entries[0]?.entryDate ?? null,
    hardestHour: patterns.hardestHours[0]?.h ?? null,
  };
}

/* ------------------------------ intent read ----------------------------- */

type Intent =
  | "greeting"
  | "overwhelm"
  | "anxiety"
  | "low_mood"
  | "sleep"
  | "focus"
  | "anger"
  | "loneliness"
  | "gratitude"
  | "habit_help"
  | "crisis"
  | "check_in"
  | "question"
  | "general";

const INTENT_PATTERNS: [Intent, RegExp][] = [
  [
    "crisis",
    /\b(kill myself|suicide|suicidal|end (it|my life)|self[- ]harm|hurt myself|don'?t want to (be here|live)|no reason to live)\b/i,
  ],
  [
    "overwhelm",
    /\b(overwhelm(ed|ing)?|too much|drowning|swamped|can'?t keep up|burn(t|ed) out|burnout|no time|slammed|underwater|breaking point)\b/i,
  ],
  [
    "anxiety",
    /\b(anxious|anxiety|panic|nervous|worried|worry|racing|dread|on edge|tense|freaking out|spiral(l?ing)?)\b/i,
  ],
  [
    "low_mood",
    /\b(sad|down|depress(ed|ing)|hopeless|empty|numb|flat|blue|awful|terrible|miserable|crying|cry)\b/i,
  ],
  ["sleep", /\b(sleep|insomnia|tired|exhaust(ed|ion)|awake|rest(ed|less)?|fatigue|can'?t sleep)\b/i],
  ["focus", /\b(focus|concentrat|distract|procrastinat|scattered|brain fog|productiv)\b/i],
  ["anger", /\b(angry|anger|furious|irritat|frustrat|annoyed|resent|pissed|rage)\b/i],
  ["loneliness", /\b(lonely|alone|isolated|no one|nobody|disconnect(ed)?)\b/i],
  [
    "gratitude",
    /\b(grateful|thank(ful)?|good (day|news|week)|went well|happy|proud|excited|great news|celebrat|promotion|promoted|i (finally|just) (got|did|landed|finished|shipped)|something good)\b/i,
  ],
  [
    "habit_help",
    /\b(habits?|routines?|streaks?|consisten(t|cy)|stick to|discipline|keep up with|fall(ing)? off)\b/i,
  ],
  [
    "check_in",
    /\b(how (am|are) i|how('| a)?m i doing|my (mood|week|patterns|data|trends)|check in|how'?s it going|summar(y|ise|ize))\b/i,
  ],
  ["greeting", /^\s*(hi|hey|hello|yo|good (morning|afternoon|evening)|hiya)\b/i],
  ["question", /\?\s*$/],
];

export function detectIntent(text: string): Intent {
  for (const [intent, re] of INTENT_PATTERNS) {
    if (re.test(text)) return intent;
  }
  return "general";
}

/* ----------------------------- memory mining ---------------------------- */

const MEMORY_HINTS: { kind: Memory["kind"]; re: RegExp; label: (m: RegExpMatchArray) => string }[] =
  [
    {
      kind: "trigger",
      re: /\b(before|during|after) (a |the |an )?(meeting|standup|review|1:1|presentation|demo|deadline|launch)\b/i,
      label: (m) => `${m[3].toLowerCase()} pressure`,
    },
    {
      kind: "trigger",
      re: /\b(my (boss|manager|lead|director)|performance review|layoff|reorg)\b/i,
      label: (m) => m[0].toLowerCase(),
    },
    {
      kind: "strategy",
      re: /\b(walk(ing|s)?|breathing|breathwork|journal(ing)?|run(ning)?|yoga|meditat(e|ion)|music|shower|stretch(ing)?)\b.{0,30}\b(help(s|ed)?|work(s|ed)?|calm(s|ed)?)\b/i,
      label: (m) => `${m[1].toLowerCase()} helps`,
    },
    {
      kind: "person",
      re: /\bmy (partner|wife|husband|friend|sister|brother|mum|mom|dad|therapist|kids?|daughter|son)\b/i,
      label: (m) => `talks about ${m[1].toLowerCase()}`,
    },
    {
      kind: "milestone",
      re: /\b(i (finally|just) |proud of|managed to |got the |finished |shipped |landed )\b/i,
      label: () => "recent win worth revisiting",
    },
  ];

/** Extract durable facts worth remembering from a user turn. */
export function mineMemories(userId: string, text: string, existing: Memory[]): string[] {
  const found: string[] = [];
  const labels = new Set(existing.map((m) => m.label.toLowerCase()));
  for (const hint of MEMORY_HINTS) {
    const m = text.match(hint.re);
    if (!m) continue;
    const label = hint.label(m).slice(0, 60);
    if (labels.has(label.toLowerCase())) {
      touchMemory(userId, label);
      found.push(label);
      continue;
    }
    createMemory(userId, {
      kind: hint.kind,
      label,
      detail: `Noticed in conversation: “${text.slice(0, 140)}”`,
      weight: 1.2,
    });
    labels.add(label.toLowerCase());
    found.push(label);
  }
  return found;
}

/* ------------------------------- composing ------------------------------ */

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function moodPhrase(ctx: CompanionContext): string | null {
  if (!ctx.moodAvg7) return null;
  if (ctx.moodDelta <= -0.6)
    return `your seven-day mood average has slipped to ${ctx.moodAvg7.toFixed(1)} — down ${Math.abs(ctx.moodDelta).toFixed(1)} from the week before`;
  if (ctx.moodDelta >= 0.6)
    return `your mood has actually been climbing — ${ctx.moodAvg7.toFixed(1)} this week, up ${ctx.moodDelta.toFixed(1)}`;
  return `your mood has been holding around ${ctx.moodAvg7.toFixed(1)} lately`;
}

function bioPhrase(ctx: CompanionContext): string | null {
  if (ctx.stressNow >= 70)
    return `your watch is reading a stress index of ${ctx.stressNow} right now, with HRV ${Math.abs(ctx.hrvDelta).toFixed(0)}ms below your baseline — your body is genuinely activated, this isn't in your head`;
  if (ctx.hrvDelta <= -6)
    return `your HRV is running ${Math.abs(ctx.hrvDelta).toFixed(0)}ms under baseline, which usually shows up for you a day or two before you notice it mentally`;
  if (ctx.sleep != null && ctx.sleep < 6.2)
    return `you got ${ctx.sleep.toFixed(1)} hours last night, and short sleep reliably makes everything feel about 20% heavier`;
  if (ctx.readiness >= 70)
    return `your readiness is sitting at ${ctx.readiness}/100, which is a good window to spend some energy`;
  return null;
}

function strategyRecall(ctx: CompanionContext): string | null {
  const strategies = ctx.memories.filter((m) => m.kind === "strategy");
  if (!strategies.length) return null;
  const top = strategies[0];
  return top.label.replace(/ helps$/, "");
}

function triggerRecall(ctx: CompanionContext): string | null {
  const t = ctx.memories.filter((m) => m.kind === "trigger");
  return t.length ? t[0].label : null;
}

const CRISIS_REPLY = `I want to pause everything else and stay right here with you.

What you just said matters, and I'm not equipped to be the only support in the room for it. Please reach out to someone who can be with you properly right now:

- **988** — Suicide & Crisis Lifeline (US), call or text, 24/7
- **Text HOME to 741741** — Crisis Text Line
- **116 123** — Samaritans (UK & Ireland)
- Or your local emergency number if you're in immediate danger

If you're able, tell one person near you what's going on — a partner, a friend, a neighbour. You don't have to explain it well. "I'm not okay and I don't want to be alone" is enough.

I'll still be here afterwards. Your history, your streaks, everything — it keeps. Right now the only thing on the list is getting you to someone who can help.`;

export interface CompanionReply {
  content: string;
  strategy: string | null;
  contextUsed: string[];
  suggestBreak: { kind: keyof typeof BREAK_LIBRARY; title: string } | null;
}

export function composeReply(
  ctx: CompanionContext,
  userText: string,
  history: Message[],
): CompanionReply {
  const intent = detectIntent(userText);
  const seed = hash(userText + history.length);
  const contextUsed: string[] = [];
  const firstName = ctx.user.name.split(" ")[0];

  if (intent === "crisis") {
    return {
      content: CRISIS_REPLY,
      strategy: "Crisis support",
      contextUsed: ["safety-protocol"],
      suggestBreak: null,
    };
  }

  const mood = moodPhrase(ctx);
  const bio = bioPhrase(ctx);
  const strategy = strategyRecall(ctx);
  const trigger = triggerRecall(ctx);
  const returning = history.filter((m) => m.role === "user").length > 0;

  const parts: string[] = [];

  /* --- opening: reflect back, grounded in something real --- */
  const openers: Record<string, string[]> = {
    overwhelm: [
      `That sounds like a lot to be holding at once.`,
      `Okay — overwhelmed is a signal, not a character flaw. Let's take the pile apart.`,
      `I hear you. When everything is urgent, nothing gets to be important.`,
    ],
    anxiety: [
      `Anxiety showing up like that is exhausting, especially when you can't point at one cause.`,
      `Let's slow this down together for a second.`,
      `That racing feeling is real and it's physiological — you're not being dramatic.`,
    ],
    low_mood: [
      `I'm glad you told me. That flatness is heavy to carry quietly.`,
      `Thank you for saying it plainly. That takes something.`,
      `That sounds genuinely hard, and I don't want to rush you out of it.`,
    ],
    sleep: [
      `Sleep debt has a way of making every other problem look worse than it is.`,
      `Let's look at what's actually happening with your rest.`,
    ],
    focus: [
      `Scattered attention is usually a downstream symptom, not the root problem.`,
      `Let's figure out whether this is a focus issue or a capacity issue.`,
    ],
    anger: [
      `Frustration usually means a boundary got crossed somewhere. Worth finding where.`,
      `That irritation is information. Let's read it rather than push it down.`,
    ],
    loneliness: [
      `Feeling disconnected is one of the hardest things to admit out loud. I'm glad you did.`,
      `That kind of alone is different from being by yourself, and it's heavier.`,
    ],
    gratitude: [
      `I love that you brought this here too — the good days deserve logging as much as the hard ones.`,
      `This is worth marking properly.`,
    ],
    habit_help: [
      `Let's look at the actual data rather than going on how it feels.`,
      `Consistency problems are almost always design problems, not willpower problems.`,
    ],
    check_in: [
      `Here's what I'm seeing across your last few weeks.`,
      `Let me pull the threads together.`,
    ],
    greeting: [
      returning ? `Hey ${firstName}. Good to pick this back up.` : `Hi ${firstName} — I'm glad you're here.`,
      `Hey. How's the day actually going, not the version you'd tell a colleague?`,
    ],
    general: [
      `I'm listening.`,
      `Tell me more about that.`,
      `Okay — let's sit with that for a moment.`,
    ],
    question: [`Good question. Let me answer it with what I actually know about you.`],
  };

  parts.push(pick(openers[intent] ?? openers.general, seed));

  /* --- the grounded observation: this is what makes it not-generic ---
     The check_in intent renders its own structured summary below, so we skip
     the free-text observation there to avoid saying the same thing twice. */
  const observations: string[] = [];
  if (intent !== "check_in") {
    if (mood && ["overwhelm", "low_mood", "anxiety", "general", "question"].includes(intent)) {
      observations.push(mood);
      contextUsed.push("mood-trend");
    }
    if (bio && ["overwhelm", "anxiety", "sleep", "focus", "anger"].includes(intent)) {
      observations.push(bio);
      contextUsed.push("biometrics");
    }
    if (ctx.topEmotions.length && ["low_mood", "anxiety"].includes(intent)) {
      const negative = ctx.topEmotions.filter((e) => !e.positive);
      if (negative.length) {
        observations.push(
          `"${negative[0].emotion}" has tagged ${negative[0].count} of your entries in the last three weeks — it's the thread running through most of them`,
        );
        contextUsed.push("emotion-tags");
      }
    }
    if (trigger && ["overwhelm", "anxiety", "anger", "general"].includes(intent)) {
      observations.push(`we've landed on ${trigger} before as something that reliably spikes you`);
      contextUsed.push(`memory:${trigger}`);
    }
  }

  if (observations.length) {
    const lead = pick(
      [
        `Something I'm noticing: `,
        `Worth naming — `,
        `For what it's worth, `,
        `One thing I can see from your data: `,
      ],
      seed + 1,
    );
    parts.push(lead + observations.slice(0, 2).join(", and ") + ".");
  }

  /* --- the personalized move --- */
  let strategyLabel: string | null = null;
  let suggestBreak: CompanionReply["suggestBreak"] = null;

  if (intent === "gratitude") {
    strategyLabel = "Savouring";
    parts.push(
      `Try this before it evaporates: spend sixty seconds writing down *what specifically* made it good and what your part in it was. Savouring is one of the few interventions with a durable effect on baseline mood, and it only works when you get concrete. ${ctx.streak > 0 ? `You're on a ${ctx.streak}-day journalling streak — this is a good one to add to it.` : ""}`,
    );
  } else if (intent === "habit_help") {
    strategyLabel = "Habit redesign";
    if (ctx.strugglingHabit) {
      parts.push(
        `**${ctx.strugglingHabit.name}** is the one to look at — you're at ${ctx.strugglingHabit.adherence}% adherence over the last four weeks. Don't add discipline to it, shrink it. Cut the target in half for two weeks and let the streak rebuild; a streak you can't break is worth more than an ambitious one you abandon.`,
      );
      contextUsed.push("habit:struggling");
    } else if (ctx.bestStreakHabit) {
      parts.push(
        `Your **${ctx.bestStreakHabit.name}** streak is at ${ctx.bestStreakHabit.streak} days — that's the anchor. The cheapest way to add a new habit is to staple it to that one: same time, same trigger, immediately after.`,
      );
      contextUsed.push("habit:anchor");
    } else {
      parts.push(
        `Start with one habit, not four, and make the first version embarrassingly small — two minutes. The point of the first two weeks is proving to yourself you show up, not the outcome.`,
      );
    }
  } else if (intent === "sleep") {
    strategyLabel = "Sleep pressure reset";
    parts.push(
      `Two things that move the needle more than sleep hygiene lists: a fixed **wake** time (not bedtime) for ten days straight, and getting outside within an hour of waking — even overcast light is 10× brighter than indoors. ${ctx.sleep != null && ctx.sleep < 6.5 ? `Given you're running on ${ctx.sleep.toFixed(1)} hours, I'd also skip the hard workout today and take a walk instead.` : ""}`,
    );
    suggestBreak = { kind: "breathing", title: "4-7-8 downshift" };
  } else if (intent === "focus") {
    strategyLabel = "Attention reset";
    parts.push(
      `Before reaching for a productivity system: your readiness is ${ctx.readiness}/100. Below about 60 the honest move is to shrink the task, not the timeline. Pick the single next physical action — not the project, the action — and set a 12-minute timer. Momentum is easier to steer than motivation.`,
    );
    suggestBreak = { kind: "micro_break", title: "Screen-free 3 minutes" };
    contextUsed.push("readiness");
  } else if (intent === "anger") {
    strategyLabel = "Somatic discharge";
    parts.push(
      `Anger is mobilising energy — it wants to go somewhere physical before it goes anywhere verbal. Give it two minutes of movement first, then answer this: what specifically was the boundary, and is it one you can actually state out loud to the person involved?`,
    );
    suggestBreak = { kind: "movement", title: "Two-minute shoulder reset" };
  } else if (intent === "loneliness") {
    strategyLabel = "Low-stakes reconnection";
    const person = ctx.memories.find((m) => m.kind === "person");
    parts.push(
      `The trap with disconnection is that it raises the bar for reaching out right when your capacity is lowest. So lower the bar deliberately: send one message that requires no emotional labour — a photo, a link, "this reminded me of you". ${person ? `You've mentioned ${person.label.replace("talks about ", "your ")} before; that might be the easiest door.` : ""}`,
    );
    if (person) contextUsed.push(`memory:${person.label}`);
  } else if (intent === "overwhelm" || intent === "anxiety") {
    strategyLabel = ctx.stressNow >= 65 ? "Downregulate first" : "Cognitive offload";
    if (ctx.stressNow >= 65) {
      parts.push(
        `Here's what I'd do in this order. **First, body, then brain** — you can't think your way out of an activated nervous system. ${strategy ? `${strategy[0].toUpperCase() + strategy.slice(1)} has worked for you before, and it's the fastest lever you've got.` : `Two minutes of box breathing: in 4, hold 4, out 4, hold 4.`} Once your heart rate settles, we do the list.`,
      );
      suggestBreak = { kind: "breathing", title: "Box breathing · 4-4-4-4" };
      if (strategy) contextUsed.push(`memory:${strategy}`);
    } else {
      parts.push(
        `Try a brain dump with a hard rule: everything on your mind goes on one list, then you mark each item **A** (only I can do this, today), **B** (only I can do this, not today), or **C** (someone else, or nobody). Most overwhelm is B and C wearing an A costume. ${strategy ? `And ${strategy} — you've told me before that it works for you.` : ""}`,
      );
      if (strategy) contextUsed.push(`memory:${strategy}`);
    }
  } else if (intent === "low_mood") {
    strategyLabel = "Behavioural activation";
    parts.push(
      `I'm not going to tell you to cheer up. The thing that actually shifts a flat stretch is **action before motivation** — one small thing that gives a flicker of competence or contact. Not the gym. Making the bed, a ten-minute walk, one text. ${ctx.bestStreakHabit ? `Your **${ctx.bestStreakHabit.name}** habit is already at ${ctx.bestStreakHabit.streak} days; keeping it alive today counts as enough.` : ""}`,
    );
    if (ctx.bestStreakHabit) contextUsed.push("habit:anchor");
  } else if (intent === "check_in") {
    strategyLabel = "Pattern review";
    const bits: string[] = [];
    bits.push(
      `**Mood** — ${ctx.moodAvg7 ? `${ctx.moodAvg7.toFixed(1)}/10 average over seven days${ctx.moodDelta ? ` (${ctx.moodDelta > 0 ? "+" : ""}${ctx.moodDelta.toFixed(1)} vs prior week)` : ""}` : "not enough entries yet"}.`,
    );
    bits.push(
      `**Body** — stress index ${ctx.stressNow}/100, readiness ${ctx.readiness}/100${ctx.sleep != null ? `, ${ctx.sleep.toFixed(1)}h sleep` : ""}.`,
    );
    bits.push(
      `**Habits** — ${ctx.habitsDone}/${ctx.habitsDue} done today${ctx.bestStreakHabit ? `, best streak is ${ctx.bestStreakHabit.name} at ${ctx.bestStreakHabit.streak} days` : ""}.`,
    );
    parts.push(bits.join("\n\n"));
    contextUsed.push("mood-trend", "biometrics", "habits");
  } else if (intent === "greeting") {
    if (ctx.habitsDue > ctx.habitsDone) {
      parts.push(
        `You've got ${ctx.habitsDue - ctx.habitsDone} ${ctx.habitsDue - ctx.habitsDone === 1 ? "habit" : "habits"} still open today, but that's not why I asked.`,
      );
      contextUsed.push("habits");
    }
  } else {
    // "general"/"question": the reflective prompt *is* the closing question,
    // so we skip the generic closer below rather than asking two in a row.
    strategyLabel = "Reflective inquiry";
    parts.push(
      pick(
        [
          `What would make the next hour 10% easier? Not the week — the next hour.`,
          `If a friend described this exact situation to you, what's the first thing you'd want to know?`,
          `Where do you feel that in your body right now?`,
        ],
        seed + 2,
      ),
    );
  }

  /* --- closing question, so it stays a conversation --- */
  const alreadyAsks = intent === "general" || intent === "question" || intent === "check_in";
  if (!alreadyAsks) {
    const closers = [
      `What feels most true out of that?`,
      `Want to go deeper on any of it, or would a two-minute reset help more right now?`,
      `Does that land, or is it missing something?`,
      `What's the part I'm not seeing yet?`,
    ];
    parts.push(pick(closers, seed + 3));
  }

  return {
    content: parts.filter(Boolean).join("\n\n"),
    strategy: strategyLabel,
    contextUsed: [...new Set(contextUsed)],
    suggestBreak,
  };
}

/* ---------------------- optional remote LLM delegation ------------------- */

function contextBlock(ctx: CompanionContext): string {
  const lines = [
    `User: ${ctx.user.name}`,
    `7-day mood avg: ${ctx.moodAvg7 || "n/a"}/10 (delta vs prior week: ${ctx.moodDelta})`,
    `Journaling streak: ${ctx.streak} days`,
    `Top emotion tags (21d): ${ctx.topEmotions.map((e) => `${e.emotion}×${e.count}`).join(", ") || "none"}`,
    `Stress index now: ${ctx.stressNow}/100; HRV delta vs baseline: ${ctx.hrvDelta}ms; readiness ${ctx.readiness}/100`,
    `Sleep last night: ${ctx.sleep ?? "unknown"}h`,
    `Habits today: ${ctx.habitsDone}/${ctx.habitsDue} complete`,
    ctx.bestStreakHabit ? `Best habit streak: ${ctx.bestStreakHabit.name} (${ctx.bestStreakHabit.streak}d)` : "",
    ctx.strugglingHabit ? `Struggling habit: ${ctx.strugglingHabit.name} (${ctx.strugglingHabit.adherence}% adherence)` : "",
    `Known memories: ${ctx.memories.map((m) => `[${m.kind}] ${m.label}`).join("; ") || "none yet"}`,
    ctx.recentEntryExcerpt ? `Most recent journal excerpt: "${ctx.recentEntryExcerpt}"` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const SYSTEM_PROMPT = `You are Vesper, a warm, direct wellness companion for people dealing with burnout.
Rules:
- Ground every reply in the user's actual data provided below. Reference specifics (numbers, habit names, past strategies). Never give generic advice.
- Be concise: 3 short paragraphs maximum. No bullet-point listicles unless summarising data.
- You are not a therapist and never diagnose. If there is any hint of self-harm, respond only with crisis resources (988, Crisis Text Line 741741, Samaritans 116 123) and encourage contacting a human.
- End with one open question, unless the user asked for a summary.
- Warm but not saccharine. No toxic positivity. Never say "as an AI".`;

export async function remoteReply(
  ctx: CompanionContext,
  userText: string,
  history: Message[],
): Promise<CompanionReply | null> {
  const key = process.env.VESPER_LLM_API_KEY;
  if (!key) return null;
  const base = process.env.VESPER_LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.VESPER_LLM_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n--- USER CONTEXT ---\n${contextBlock(ctx)}` },
          ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userText },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return {
      content,
      strategy: "Guided reflection",
      contextUsed: ["mood-trend", "biometrics", "habits", "memories"],
      suggestBreak: ctx.stressNow >= 65 ? { kind: "breathing", title: "Box breathing · 4-4-4-4" } : null,
    };
  } catch {
    return null;
  }
}

/** Main entry point: remote if configured, local composer otherwise. */
export async function generateReply(
  user: User,
  conversationId: string,
  userText: string,
): Promise<CompanionReply> {
  const ctx = buildContext(user);
  const history = listMessages(user.id, conversationId);
  mineMemories(user.id, userText, ctx.memories);
  const remote = await remoteReply(ctx, userText, history);
  return remote ?? composeReply(ctx, userText, history);
}

/** Suggest an opening line for a brand-new conversation. */
export function openingPrompt(ctx: CompanionContext): string {
  if (ctx.stressNow >= 70)
    return `Your stress index is at ${ctx.stressNow} and HRV is below baseline. Before anything else — want to do two minutes of breathing together?`;
  if (ctx.moodDelta <= -0.8)
    return `Your mood's dipped about ${Math.abs(ctx.moodDelta).toFixed(1)} points from last week. I'd rather hear it from you than guess — what's been going on?`;
  if (ctx.sleep != null && ctx.sleep < 6)
    return `${ctx.sleep.toFixed(1)} hours last night. How are you actually doing on that?`;
  if (ctx.streak >= 5)
    return `${ctx.streak} days of journalling in a row — that consistency is doing real work. What's on your mind today?`;
  return `I'm here. What's taking up the most space in your head right now?`;
}

export const CONVERSATION_STARTERS = [
  "I'm running on empty and the week isn't over",
  "Help me wind down before bed",
  "Show me what my patterns look like lately",
  "I keep breaking my own routines",
  "Something good happened today",
];
