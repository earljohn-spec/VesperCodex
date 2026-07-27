import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMemories } from "@/lib/repos/conversations";
import { MemoryView } from "./memory-view";

export const metadata: Metadata = { title: "Memory" };
export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <MemoryView memories={await listMemories(user.id)} />;
}
