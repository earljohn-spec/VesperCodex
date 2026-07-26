import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import {
  deleteConversation,
  getConversation,
  listMessages,
  updateConversation,
} from "@/lib/repos/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().max(120).optional(),
  summary: z.string().max(400).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const GET = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const conversation = getConversation(user.id, id);
  if (!conversation) return fail("Conversation not found", 404);
  return ok({ conversation, messages: listMessages(user.id, id) });
});

export const PATCH = withUser(async (user, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const conversation = updateConversation(user.id, id, input);
  return conversation ? ok({ conversation }) : fail("Conversation not found", 404);
});

export const DELETE = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return deleteConversation(user.id, id) ? ok({ deleted: id }) : fail("Conversation not found", 404);
});
