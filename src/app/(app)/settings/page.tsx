import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { journalStats } from "@/lib/repos/journal";
import { listMemories } from "@/lib/repos/conversations";
import { listDevices } from "@/lib/repos/biometrics";
import { query } from "@/lib/db";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const syncEvents = query<{
    id: string;
    resource: string;
    action: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, resource, action, status, created_at FROM sync_events
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 8`,
    [user.id],
  );

  const counts = {
    entries: journalStats(user.id).total,
    memories: listMemories(user.id).length,
    devices: listDevices(user.id).length,
    pending: journalStats(user.id).pendingSync,
  };

  return (
    <SettingsView
      user={user}
      counts={counts}
      syncEvents={syncEvents.map((s) => ({
        id: s.id,
        resource: s.resource,
        action: s.action,
        status: s.status,
        createdAt: s.created_at,
      }))}
    />
  );
}
