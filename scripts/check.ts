/**
 * Dev sanity check: prints the derived stats for the demo account so we can
 * verify the seeded narrative is coherent (mood arc, HRV, habits, insights).
 * Run with: npx tsx scripts/check.ts
 */
import Module from "node:module";

// `server-only` intentionally throws outside a bundler; stub it for this script.
type Loader = (this: unknown, ...args: unknown[]) => unknown;
const mod = Module as unknown as { _load: Loader };
const origLoad = mod._load;
mod._load = function (this: unknown, request: unknown, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, ...rest);
};

async function main() {
  const { journalStats, moodTrend, emotionBreakdown } = await import("../src/lib/repos/journal");
  const { biometricSummary } = await import("../src/lib/repos/biometrics");
  const { habitSummary, listHabits } = await import("../src/lib/repos/habits");
  const { interventionSummary } = await import("../src/lib/repos/interventions");
  const { listConversations } = await import("../src/lib/repos/conversations");
  const { queryOne } = await import("../src/lib/db");

  const u = queryOne<{ id: string }>(`SELECT id FROM users WHERE email='maya@vesper.app'`);
  if (!u) throw new Error("Demo user missing — run npm run db:seed");

  console.log("\n── JOURNAL ─────────────────────────────");
  console.log(journalStats(u.id));
  console.log("\n── BIOMETRICS ──────────────────────────");
  console.log(biometricSummary(u.id));
  console.log("\n── HABITS ──────────────────────────────");
  console.log(habitSummary(u.id));
  console.log(listHabits(u.id).map((h) => `  ${h.name}: streak ${h.currentStreak}d, adherence ${h.adherence}%`).join("\n"));
  console.log("\n── INTERVENTIONS ───────────────────────");
  console.log(interventionSummary(u.id));
  console.log("\n── EMOTIONS (21d) ──────────────────────");
  console.log(emotionBreakdown(u.id, 21).slice(0, 6));
  console.log("\n── MOOD ARC ────────────────────────────");
  const t = moodTrend(u.id, 60).filter((p) => p.mood !== null);
  console.log("  oldest:", t[0], "\n  middle:", t[Math.floor(t.length / 2)], "\n  latest:", t[t.length - 1]);
  console.log("\n── CONVERSATIONS ───────────────────────");
  console.log(listConversations(u.id).map((c) => `  ${c.title} (${c.messageCount} msgs)`).join("\n"));
  console.log();
}

main();
