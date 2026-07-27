import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { emotionBreakdown, journalStats, listEntries, moodTrend } from "@/lib/repos/journal";
import { JournalView } from "./journal-view";

export const metadata: Metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; entry?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;

  return (
    <JournalView
      entries={await listEntries(user.id, { limit: 200 })}
      stats={await journalStats(user.id)}
      trend={await moodTrend(user.id, 30)}
      emotions={await emotionBreakdown(user.id, 30)}
      openNew={sp.new === "1"}
      focusEntry={sp.entry}
    />
  );
}
