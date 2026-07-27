import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { deleteHabit, getHabit, updateHabit } from "@/lib/repos/habits";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  cadence: z.enum(["daily", "weekdays", "weekly"]).optional(),
  targetPerWeek: z.number().int().min(1).max(7).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  archived: z.boolean().optional(),
});

export const GET = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const habit = await getHabit(user.id, id);
  return habit ? ok({ habit }) : fail("Habit not found", 404);
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, updateSchema);
  const habit = await updateHabit(user.id, id, input);
  return habit ? ok({ habit }) : fail("Habit not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return await deleteHabit(user.id, id) ? ok({ deleted: id }) : fail("Habit not found", 404);
});
