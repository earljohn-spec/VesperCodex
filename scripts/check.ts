/**
 * Dev sanity check: prints the derived stats for the demo account so we can
 * verify the seeded narrative is coherent (mood arc, HRV, habits, insights).
 * Run with: npx tsx scripts/check.ts
 */
import "./_shim";

async function main() {
  const { journalStats, moodTrend, emotionBreakdown } = await import("../src/lib/repos/journal");
  const { biometricSummary } = await import("../src/lib/repos/biometrics");
  const { habitSummary, listHabits } = await import("../src/lib/repos/habits");
  const { interventionSummary } = await import("../src/lib/repos/interventions");
  const { listConversations } = await import("../src/lib/repos/conversations");
  const { queryOne } = await import("../src/lib/db");

  const u = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email='maya@vesper.app'`);
  if (!u) throw new Error("Demo user missing — run npm run db:seed");

  console.log("\n── JOURNAL ─────────────────────────────");
  console.log(await journalStats(u.id));
  console.log("\n── BIOMETRICS ──────────────────────────");
  console.log(await biometricSummary(u.id));
  console.log("\n── HABITS ──────────────────────────────");
  console.log(await habitSummary(u.id));
  console.log((await listHabits(u.id)).map((h) => `  ${h.name}: streak ${h.currentStreak}d, adherence ${h.adherence}%`).join("\n"));
  console.log("\n── INTERVENTIONS ───────────────────────");
  console.log(await interventionSummary(u.id));
  console.log("\n── EMOTIONS (21d) ──────────────────────");
  console.log((await emotionBreakdown(u.id, 21)).slice(0, 6));
  console.log("\n── MOOD ARC ────────────────────────────");
  const t = (await moodTrend(u.id, 60)).filter((p) => p.mood !== null);
  console.log("  oldest:", t[0], "\n  middle:", t[Math.floor(t.length / 2)], "\n  latest:", t[t.length - 1]);
  console.log("\n── CONVERSATIONS ───────────────────────");
  console.log((await listConversations(u.id)).map((c) => `  ${c.title} (${c.messageCount} msgs)`).join("\n"));
  console.log();
}

main();
