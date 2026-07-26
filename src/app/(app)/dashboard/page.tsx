import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { emotionBreakdown, journalStats, listEntries, moodTrend } from "@/lib/repos/journal";
import { biometricSummary, listBiometrics } from "@/lib/repos/biometrics";
import { habitSummary, listHabits } from "@/lib/repos/habits";
import { activeInterventions, interventionSummary } from "@/lib/repos/interventions";
import { buildContext, openingPrompt } from "@/lib/companion";
import { DashboardView } from "./dashboard-view";
import { CardSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5 lg:p-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

async function DashboardData() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const stats = journalStats(user.id);
  const bio = biometricSummary(user.id);
  const habits = listHabits(user.id);
  const hSummary = habitSummary(user.id);
  const breaks = activeInterventions(user.id);
  const bSummary = interventionSummary(user.id);
  const trend = moodTrend(user.id, 30);
  const emotions = emotionBreakdown(user.id, 30).slice(0, 8);
  const recent = listEntries(user.id, { limit: 3 });
  const todaySamples = listBiometrics(user.id, 14);
  const ctx = buildContext(user);

  return (
    <DashboardView
      user={user}
      stats={stats}
      bio={bio}
      habits={habits}
      habitSummary={hSummary}
      activeBreaks={breaks}
      breakSummary={bSummary}
      trend={trend}
      emotions={emotions}
      recentEntries={recent}
      samples={todaySamples}
      prompt={openingPrompt(ctx)}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  );
}
