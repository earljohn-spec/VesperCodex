# Vesper

An AI-powered wellness companion for people running on empty — built for burnout, not for streak-shaming.

Vesper grounds every response in your actual data: mood history, heart-rate variability against your
own baseline, habit adherence, and the coping strategies that have genuinely worked for you before.
The design goal is context-awareness. Generic advice is the failure mode it's built against.

```
maya@vesper.app  /  wellness123
```

---

## Quick start

```bash
npm install
npm run db:seed     # 60 days of realistic demo history
npm run dev         # http://localhost:3000
```

Sign in with the demo account above, or hit **Explore the demo account** on the login screen.
New accounts get a small starter set (three habits, a welcome conversation, a simulated watch) so
nobody lands in an empty shell.

## Features

**Context-aware chat** — The companion reads your seven-day mood average, HRV delta, habit streaks,
and stored memories before it answers. Ask it "how am I doing?" and it returns *your* numbers. Tell
it you're overwhelmed and it references the trigger you two identified three weeks ago. Every reply
shows which context it drew on.

**Biometric stress detection** — Simulated wearable samples feed a derived stress index
(HRV + heart-rate lift + respiration). Cross 65 and Vesper creates a micro-break suggestion,
deduplicated so you get one nudge, not a pile. Hit **Simulate spike** on the Biometrics page to
watch the whole detection → intervention loop fire.

**Mood journalling with insights** — Voice-to-text via the Web Speech API (on-device, nothing
uploaded). Emotions are auto-tagged from what you write as you write it. Mood and energy trends
chart over 30 days, with best/hardest days surfaced.

**Habits without rigidity** — Streaks, 14-day heat strips, four-week adherence. Archive instead of
delete when something isn't working. Missing a day is treated as data, not failure.

**Offline mode** — Journalling, habit ticks, and breathing exercises all work with no connection.
Writes queue in `localStorage` and replay automatically when you reconnect. Toggle
**Settings → Simulate being offline** to exercise it without unplugging anything.

**Visible memory** — An AI that claims to remember you should let you see the memory. The Memory
page lists every note Vesper has formed, weighted by how heavily it leans on them. Edit or delete
any of it.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions) |
| UI | React 19, Tailwind CSS v4 |
| Database | SQLite via Node's built-in `node:sqlite` |
| Auth | scrypt password hashing + JWT sessions (`jose`), httpOnly cookies |
| Validation | Zod on every API route |
| Charts | Hand-rolled SVG — no charting dependency |

**Why `node:sqlite`?** It ships with Node 22.5+, so there's no native compilation step and no
`better-sqlite3` build failures on machines without Python and a C++ toolchain. Requires Node ≥ 22.5.

## Project layout

```
src/
  app/
    (auth)/          login, signup
    (app)/           dashboard, chat, journal, habits,
                     biometrics, breaks, memory, settings
    api/             REST routes for every resource
  components/        ui primitives, charts, breathing player,
                     sidebar, offline queue, voice recorder
  lib/
    companion.ts     the context-aware reply engine
    db.ts            schema + query helpers
    auth.ts          sessions and password hashing
    repos/           data access per resource
scripts/
  seed.ts            60-day demo narrative
  reset.ts           wipe the database
  check.ts           print derived stats (sanity check)
```

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run db:seed     # reseed demo data (idempotent)
npm run db:reset    # delete the database
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (flat config, ESLint 9)
npx tsx scripts/check.ts   # print derived stats for the demo account
```

## Checking for problems

Four commands, cheapest first. All four are currently clean.

```bash
npm run typecheck   # type errors
npm run lint        # unused vars, React rule violations, a11y
npm run build       # catches anything only production surfaces
npx tsx scripts/check.ts   # verifies seeded data is coherent
```

Then open DevTools (F12) → Console while clicking through the app. React
reports duplicate keys, hydration mismatches, and invalid nesting there and
nowhere else — a page can return 200 and still be warning in the console.

Note `next lint` was removed in Next.js 16; this project uses ESLint directly
via `eslint.config.mjs`.

## Optional: use a real LLM

Vesper runs fully offline by default with a local reply composer — that's what makes the demo work
out of the box. To route phrasing through an OpenAI-compatible model instead:

```bash
VESPER_LLM_API_KEY=sk-...
VESPER_LLM_BASE_URL=https://api.openai.com/v1   # optional
VESPER_LLM_MODEL=gpt-4o-mini                    # optional
```

The same grounded context block is sent either way, and it falls back to local generation if the
call fails or times out.

Other environment variables:

```bash
VESPER_AUTH_SECRET=...      # set this in production
VESPER_DB_PATH=./.data/vesper.db
```

## Safety

Vesper is a wellbeing tool, not therapy, diagnosis, or crisis care, and the biometric readings in
this build are simulated locally rather than clinical measurements. The companion detects crisis
language and responds only with hotline resources and encouragement to reach a human — it will not
try to counsel someone through it. Crisis numbers are listed on the Settings page.
