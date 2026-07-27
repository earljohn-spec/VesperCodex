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
npm run test        # security tests: rate limiting, reset, deletion
npx tsx scripts/check.ts   # print derived stats for the demo account
```

## Checking for problems

Four commands, cheapest first. All four are currently clean.

```bash
npm run typecheck   # type errors
npm run lint        # unused vars, React rule violations, a11y
npm run test        # 24 assertions on auth/rate-limit/deletion
npm run build       # catches anything only production surfaces
npx tsx scripts/check.ts   # verifies seeded data is coherent
```

Then open DevTools (F12) → Console while clicking through the app. React
reports duplicate keys, hydration mismatches, and invalid nesting there and
nowhere else — a page can return 200 and still be warning in the console.

Note `next lint` was removed in Next.js 16; this project uses ESLint directly
via `eslint.config.mjs`.

### If `git pull` says "local changes would be overwritten"

Almost always `package-lock.json`, which npm rewrites on install. It's a
generated file, so discarding your copy is safe:

```bash
git checkout -- package-lock.json
git pull
npm install
```

Prefer `npm ci` over `npm install` when you just want to sync dependencies —
it installs strictly from the lockfile and never modifies it, so this can't
happen in the first place.

If Git names a **source** file you actually edited, stash instead:
`git stash` → `git pull` → `git stash pop`.

### About `npm audit`

`npm audit` reports advisories in ESLint's own transitive dependencies
(`brace-expansion` via an old `minimatch`). Those are **dev-only** — they never
ship in a build. Production dependencies are clean:

```bash
npm audit --omit=dev   # found 0 vulnerabilities
```

Do **not** run `npm audit fix --force` here: npm's suggested "fix" for the
`postcss`/`sharp` advisories is to downgrade Next.js to 9.3.3, which would
break the app. Those two are instead pinned to patched versions via
`overrides` in package.json.


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

## Production readiness

This is a complete, working application, but a few things are deliberately
out of scope for a demo build. Read this before deploying it for real users.

**Required before deploy**
- Set `VESPER_AUTH_SECRET` (see `.env.example`). The app refuses to start in
  production without it — the development fallback is public in this repo.
- Point `VESPER_DB_PATH` at a persistent volume. SQLite on an ephemeral
  filesystem (Vercel, Heroku) loses every write on redeploy.

**Implemented**
- Password reset — hashed single-use tokens, 1-hour expiry, revokes all
  sessions on use. No mail provider is wired up: the link is printed to the
  server console and shown in the UI outside production.
- Rate limiting — per-IP and per-account on login, plus signup, reset and
  chat. Fixed-window counters in SQLite, so they survive restarts.
- Account deletion and JSON export (GDPR erasure and portability).
- Security tests covering all of the above (`npm run test`).

**Still not implemented**
- Email delivery (swap `deliverResetEmail` for Resend/SES/Postmark)
- Email verification on signup
- Real wearable APIs — biometrics are simulated locally

A ready-to-use CI pipeline lives at `docs/ci.yml.example`. Copy it to
`.github/workflows/ci.yml` to enable it — it runs typecheck, lint, the
security tests, a build, and a production dependency audit on every push.
- Multi-device sync conflict resolution beyond last-write-wins

**If you handle real users' mental-health data**, note that this content is
likely regulated (HIPAA in the US, GDPR special-category data in the EU).
At minimum you would need encryption at rest, audit logging, a data-processing
agreement, and a privacy policy. None of that is in here.

## Safety

Vesper is a wellbeing tool, not therapy, diagnosis, or crisis care, and the biometric readings in
this build are simulated locally rather than clinical measurements. The companion detects crisis
language and responds only with hotline resources and encouragement to reach a human — it will not
try to counsel someone through it. Crisis numbers are listed on the Settings page.
