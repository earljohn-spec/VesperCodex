import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { createConversation, listConversations } from "@/lib/repos/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().max(120).optional(),
  summary: z.string().max(400).optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "true";
  return ok({ conversations: await listConversations(user.id, includeArchived) });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema).catch(() => ({}));
  const conversation = await createConversation(user.id, input);
  return ok({ conversation }, 201);
});
