import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { toggleHabitLog } from "@/lib/repos/habits";
import { todayKey } from "@/lib/utils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(280).optional(),
});

export const POST = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema).catch(() => ({ date: undefined, note: undefined }));
  const habit = toggleHabitLog(user.id, id, input.date ?? todayKey(), input.note ?? "");
  return habit ? ok({ habit }) : fail("Habit not found", 404);
});
