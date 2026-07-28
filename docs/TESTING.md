# Testing Vesper by hand

Every step below has been run and verified. Automated suites come first
because they're fastest; the manual walkthroughs cover what a browser does
that a test can't.

---

## 1. Automated suites (~40 seconds)

```powershell
npm run typecheck    # 0 errors
npm run lint         # 0 errors, 0 warnings
npm run test         # 24 — rate limiting, password reset, account deletion
npm run test:pg      # 23 — Postgres schema + queries (via PGlite, no server needed)
npm run test:mail    # 24 — templates + real SMTP delivery
npm run test:verify  # 27 — email verification lifecycle
npm run test:googlehealth  # 44 — Google Health OAuth + API mapping
npm run test:webhook       # 19 — webhook signature verification
npm run build        # production build
```

98 assertions total. If all of these pass, the backend is sound.

---

## 2. Start the app

```powershell
npm run dev
```

Open <http://localhost:3000> and sign in:

```
maya@vesper.app  /  wellness123
```

Credentials are pre-filled — just click **Sign in**.

---

## 3. Core features to click through

| Where | What to try | What should happen |
|---|---|---|
| **Today** | Tick a habit | Fills in instantly (optimistic), streak count bumps |
| **Companion** | Ask *"how am I doing lately?"* | Replies with *your* real numbers, not generic advice |
| **Companion** | Say *"I'm exhausted and overwhelmed"* | Names a specific coping strategy; may offer a breathing break |
| **Journal** | **New entry**, type "I feel anxious about tomorrow" | Emotion tags auto-appear as you type |
| **Journal** | Click the mic (Chrome/Edge only) | Speech transcribes on-device |
| **Biometrics** | **Simulate spike** | Stress jumps, a micro-break suggestion appears |
| **Micro-breaks** | Start box breathing | Orb expands/contracts in time with the 4-4-4-4 count |
| **Memory** | Browse the entries | Everything the companion "knows", editable and deletable |
| **Settings** | Toggle **Simulate being offline** | Banner appears; journalling still works and queues |

### Offline mode

1. **Settings → Simulate being offline** → on
2. Go to **Journal**, add an entry — it saves and shows *pending*
3. Toggle offline back **off**
4. The queue drains automatically and the pending badge clears

---

## 4. Password reset (no email setup needed)

1. Sign out
2. **Forgot?** next to the password field
3. Enter `maya@vesper.app` → **Send reset link**
4. The link appears **on the page** under "Development only", and also in your
   terminal where `npm run dev` is running
5. Click it, set a new password, sign in with it

The old password stops working, and every other session is signed out.

> The page always says "if an account exists…" whether or not it does. That's
> deliberate — confirming an address is registered would leak who uses a
> mental-health app.

---

## 5. Email verification

Sign up a new account at `/signup`. The confirmation link prints to your
terminal. **Settings → Email** shows the unconfirmed state and can resend.

Verification is soft: nothing is locked if you skip it.

---

## 6. Optional — see real emails in a local inbox

Proves actual SMTP delivery rather than console output.

In a **second terminal**:

```powershell
npx maildev --smtp 1025 --web 1080
```

Then stop `npm run dev`, and restart it with the SMTP variables set:

```powershell
$env:SMTP_URL="smtp://127.0.0.1:1025"
$env:MAIL_FROM="Vesper <no-reply@vesper.test>"
npm run dev
```

Now trigger a password reset. The link **no longer appears in the UI** — it's a
real email. Open <http://localhost:1080> to read it, styling and all, and click
the link from there.

That disappearance is the security property working: once a real transport is
configured, the link can only reach you by email.

To go back to console mode, close the terminal or:

```powershell
Remove-Item Env:SMTP_URL
```

---

## 7. Fitbit / Google Health (optional)

Without credentials the Biometrics page shows "Not configured" and keeps using
simulated readings — that's the expected default.

> The old `dev.fitbit.com` route no longer accepts new apps. Google is retiring
> the Fitbit Web API in September 2026; Fitbit data now comes through the
> **Google Health API**.

To try the real flow:

1. **[console.cloud.google.com](https://console.cloud.google.com)** → create a project
2. **APIs & Services → Library** → search *Google Health API* → **Enable**
3. **Credentials → Create credentials → OAuth client ID → Web application**
   Authorized redirect URI (exactly):
   ```
   http://localhost:3000/api/integrations/google-health/callback
   ```
   Copy the **Client ID** and **Client secret**.
4. **APIs & Services → OAuth consent screen → Audience** → under **Test users**
   add your own Google address. Up to 100 without a security review.
5. **Data Access** → add the `googlehealth` `*.readonly` scopes you want
   (health metrics, activity and fitness, sleep).

Then:

```powershell
$env:GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"
npm run dev
```

**Biometrics → Connect Google Health** → approve → you land back as *linked* →
**Pull today's data**.

Your Fitbit account must be linked to the Google account you authorise with,
and the device needs to have synced recently for there to be data.

### Testing the webhook without a public URL

The webhook needs an HTTPS endpoint Google can reach, but you can exercise the
handler locally. Start the server with a token and the dev signature bypass:

```powershell
$env:GOOGLE_HEALTH_WEBHOOK_TOKEN="Bearer test-token"
$env:GOOGLE_HEALTH_SKIP_SIGNATURE="true"
npm run dev
```

Then, from another terminal:

```powershell
# Google's handshake: authorised must be 200, unauthorised must be 401
curl -X POST -H "Authorization: Bearer test-token" -H "Content-Type: application/json" `
  -d '{\"type\":\"verification\"}' http://localhost:3000/api/integrations/google-health/webhook
```

A real notification should return `204` immediately. The bypass only works
outside production — `npm run test:webhook` asserts that.

No device or Google project? `npm run test:googlehealth` exercises the entire
flow — PKCE, token exchange, refresh, encryption at rest, API mapping, partial
consent, rate limits, revoked grants — against a local mock (44 assertions).

## 8. Try Postgres instead of SQLite

Same code, one environment variable. With a Postgres instance available:

```powershell
$env:DATABASE_URL="postgres://user:pass@localhost:5432/vesper"
npm run db:seed
npm run dev
```

The schema creates itself on first connect. `npm run test:pg` already verifies
this path against real Postgres (compiled to WASM), so it works without a
server too.

---

## Resetting

```powershell
npm run db:reset    # delete everything
npm run db:seed     # regenerate the 60-day demo history
```

Seeded data is anchored to the current date, so the dashboard always looks
current no matter when you run it.

---

## Known limitations

- **Biometrics are simulated unless you connect Google Health.** The
  stress-detection logic and intervention loop are real either way. Apple
  HealthKit isn't supported — it needs a native iOS app.
- **Voice journalling needs Chrome, Edge or Safari.** Firefox lacks the Web
  Speech API; the UI says so and falls back to typing.
- **The companion runs locally by default.** Set `VESPER_LLM_API_KEY` to route
  phrasing through an OpenAI-compatible model instead.
