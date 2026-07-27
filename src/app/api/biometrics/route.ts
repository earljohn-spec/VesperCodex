import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { biometricSummary, createBiometric, listBiometrics } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  hrv: z.number().min(5).max(200).nullable().optional(),
  restingHr: z.number().min(30).max(120).nullable().optional(),
  heartRate: z.number().min(30).max(220).nullable().optional(),
  respiration: z.number().min(4).max(40).nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  steps: z.number().int().min(0).max(200_000).nullable().optional(),
  deviceId: z.string().nullable().optional(),
  recordedAt: z.string().optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  const hours = Number(url.searchParams.get("hours") ?? 24);
  return ok({ samples: await listBiometrics(user.id, hours), summary: await biometricSummary(user.id) });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema);
  return ok({ sample: await createBiometric(user.id, input), summary: await biometricSummary(user.id) }, 201);
});
