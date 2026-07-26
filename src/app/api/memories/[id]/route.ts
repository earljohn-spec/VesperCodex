import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { deleteMemory, updateMemory } from "@/lib/repos/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  kind: z.enum(["trigger", "strategy", "preference", "milestone", "person"]).optional(),
  label: z.string().min(1).max(80).optional(),
  detail: z.string().max(600).optional(),
  weight: z.number().min(0).max(5).optional(),
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const memory = updateMemory(user.id, id, input);
  return memory ? ok({ memory }) : fail("Memory not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return deleteMemory(user.id, id) ? ok({ deleted: id }) : fail("Memory not found", 404);
});
