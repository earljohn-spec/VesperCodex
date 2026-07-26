import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { deleteEntry, getEntry, updateEntry } from "@/lib/repos/journal";
import { EMOTION_TAGS } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().max(140).optional(),
  body: z.string().max(20_000).optional(),
  moodScore: z.number().int().min(1).max(10).optional(),
  energyScore: z.number().int().min(1).max(10).optional(),
  emotions: z.array(z.enum(EMOTION_TAGS as [string, ...string[]])).max(8).optional(),
  source: z.enum(["text", "voice"]).optional(),
  entryDate: z.string().optional(),
  synced: z.boolean().optional(),
});

export const GET = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const entry = getEntry(user.id, id);
  return entry ? ok({ entry }) : fail("Entry not found", 404);
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, updateSchema);
  const entry = updateEntry(user.id, id, input);
  return entry ? ok({ entry }) : fail("Entry not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return deleteEntry(user.id, id) ? ok({ deleted: id }) : fail("Entry not found", 404);
});
