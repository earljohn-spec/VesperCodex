import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { biometricSummary, listBiometrics, listDevices } from "@/lib/repos/biometrics";
import { listInterventions } from "@/lib/repos/interventions";
import { BiometricsView } from "./biometrics-view";

export const metadata: Metadata = { title: "Biometrics" };
export const dynamic = "force-dynamic";

export default async function BiometricsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <BiometricsView
      devices={await listDevices(user.id)}
      summary={await biometricSummary(user.id)}
      samples={await listBiometrics(user.id, 24)}
      recentSpikes={await listInterventions(user.id, { limit: 6 })}
    />
  );
}
