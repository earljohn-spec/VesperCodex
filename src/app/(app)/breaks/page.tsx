import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BREAK_LIBRARY, interventionSummary, listInterventions } from "@/lib/repos/interventions";
import { biometricSummary } from "@/lib/repos/biometrics";
import { BreaksView } from "./breaks-view";

export const metadata: Metadata = { title: "Micro-breaks" };
export const dynamic = "force-dynamic";

export default async function BreaksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <BreaksView
      interventions={listInterventions(user.id, { limit: 60 })}
      summary={interventionSummary(user.id)}
      stressNow={biometricSummary(user.id).stressNow}
      library={BREAK_LIBRARY}
    />
  );
}
