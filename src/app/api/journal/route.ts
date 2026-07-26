import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { createEntry, listEntries } from "@/lib/repos/journal";
import { EMOTION_TAGS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().max(140).optional(),
  body: z.string().max(20_000).optional(),
  moodScore: z.number().int().min(1).max(10),
  energyScore: z.number().int().min(1).max(10).optional(),
  emotions: z.array(z.enum(EMOTION_TAGS as [string, ...string[]])).max(8).optional(),
  source: z.enum(["text", "voice"]).optional(),
  transcriptMs: z.number().int().nonnegative().nullable().optional(),
  entryDate: z.string().optional(),
  synced: z.boolean().optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  const entries = listEntries(user.id, {
    search: url.searchParams.get("search") ?? undefined,
    emotion: url.searchParams.get("emotion") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 200),
  });
  return ok({ entries });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, createSchema);
  if (!input.body?.trim() && !input.title?.trim()) {
    return fail("Add a title or a few words before saving", 422, {
      fieldErrors: { body: "Write something first" },
    });
  }
  const entry = createEntry(user.id, input);
  return ok({ entry }, 201);
});
