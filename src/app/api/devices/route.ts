import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { createDevice, listDevices } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["apple_watch", "fitbit", "oura", "garmin", "manual"]),
  displayName: z.string().min(1, "Name the device").max(80),
  status: z.enum(["connected", "syncing", "paused", "error"]).optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
});

export const GET = withUser(async (user) => ok({ devices: listDevices(user.id) }));

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema);
  return ok({ device: createDevice(user.id, input) }, 201);
});
