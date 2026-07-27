import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { habitSummary, listHabits } from "@/lib/repos/habits";
import { HabitsView } from "./habits-view";

export const metadata: Metadata = { title: "Habits" };
export const dynamic = "force-dynamic";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  return (
    <HabitsView
      habits={await listHabits(user.id, true)}
      summary={await habitSummary(user.id)}
      openNew={sp.new === "1"}
    />
  );
}
