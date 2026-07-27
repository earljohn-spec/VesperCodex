import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { deleteIntervention, updateIntervention } from "@/lib/repos/interventions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["suggested", "completed", "dismissed", "snoozed"]).optional(),
  kind: z.enum(["breathing", "micro_break", "grounding", "movement", "reflection"]).optional(),
  title: z.string().max(120).optional(),
  detail: z.string().max(1000).optional(),
  durationSec: z.number().int().min(30).max(3600).optional(),
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const intervention = await updateIntervention(user.id, id, input);
  return intervention ? ok({ intervention }) : fail("Break not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return await deleteIntervention(user.id, id) ? ok({ deleted: id }) : fail("Break not found", 404);
});
