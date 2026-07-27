import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { biometricSummary, listBiometrics, listDevices } from "@/lib/repos/biometrics";
import { listInterventions } from "@/lib/repos/interventions";
import { googleHealthConfigured, getConnection } from "@/lib/google-health";
import { BiometricsView } from "./biometrics-view";

export const metadata: Metadata = { title: "Biometrics" };
export const dynamic = "force-dynamic";

export default async function BiometricsPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const conn = await getConnection(user.id);

  return (
    <BiometricsView
      healthConfigured={googleHealthConfigured()}
      healthStatus={{
        connected: !!conn,
        scopes: conn?.scopes ?? null,
        lastSyncAt: conn?.lastSyncAt ?? null,
        lastError: conn?.lastError ?? null,
      }}
      healthCallback={sp.health}
      devices={await listDevices(user.id)}
      summary={await biometricSummary(user.id)}
      samples={await listBiometrics(user.id, 24)}
      recentSpikes={await listInterventions(user.id, { limit: 6 })}
    />
  );
}
