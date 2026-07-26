import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { journalStats } from "@/lib/repos/journal";
import { interventionSummary } from "@/lib/repos/interventions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const stats = journalStats(user.id);
  const breaks = interventionSummary(user.id);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar user={user} pendingCount={stats.pendingSync} activeBreaks={breaks.activeCount} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
