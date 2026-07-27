import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { createHabit, listHabits } from "@/lib/repos/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1, "Give the habit a name").max(80),
  description: z.string().max(400).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  cadence: z.enum(["daily", "weekdays", "weekly"]).optional(),
  targetPerWeek: z.number().int().min(1).max(7).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "true";
  return ok({ habits: await listHabits(user.id, includeArchived) });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, createSchema);
  const habit = await createHabit(user.id, input);
  return ok({ habit }, 201);
});
