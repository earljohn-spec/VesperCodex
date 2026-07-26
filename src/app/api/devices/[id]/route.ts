import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { deleteDevice, updateDevice } from "@/lib/repos/biometrics";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  provider: z.enum(["apple_watch", "fitbit", "oura", "garmin", "manual"]).optional(),
  displayName: z.string().min(1).max(80).optional(),
  status: z.enum(["connected", "syncing", "paused", "error"]).optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const device = updateDevice(user.id, id, input);
  return device ? ok({ device }) : fail("Device not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return deleteDevice(user.id, id) ? ok({ deleted: id }) : fail("Device not found", 404);
});
