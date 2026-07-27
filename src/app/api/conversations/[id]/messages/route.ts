import { z } from "zod";
import { enforceLimit, fail, ok, parseBody, withUser } from "@/lib/api";
import {
  addMessage,
  getConversation,
  listMessages,
  updateConversation,
} from "@/lib/repos/conversations";
import { generateReply } from "@/lib/companion";
import { createIntervention } from "@/lib/repos/interventions";
import { BREAK_LIBRARY } from "@/lib/repos/interventions";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  content: z.string().min(1, "Say something first").max(4000),
});

export const GET = withUser(async (user, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!getConversation(user.id, id)) return fail("Conversation not found", 404);
  return ok({ messages: listMessages(user.id, id) });
});

export const POST = withUser(async (user, req: Request, ctx: Ctx) => {
  // The companion is the costliest thing we expose — cap it per user.
  const limited = enforceLimit("chat", user.id);
  if (limited) return limited;

  const { id } = await ctx.params;
  const conversation = getConversation(user.id, id);
  if (!conversation) return fail("Conversation not found", 404);

  const { content } = await parseBody(req, schema);

  const userMessage = addMessage(user.id, id, { role: "user", content });

  // Title an untitled conversation from its first user turn.
  if (conversation.title === "New conversation") {
    const title = content.replace(/\s+/g, " ").trim().slice(0, 52);
    updateConversation(user.id, id, {
      title: title.length < content.trim().length ? `${title}…` : title,
    });
  }

  const reply = await generateReply(user, id, content);

  const assistantMessage = addMessage(user.id, id, {
    role: "assistant",
    content: reply.content,
    strategy: reply.strategy,
    contextUsed: reply.contextUsed,
  });

  // If the companion recommended a reset, materialise it as a real
  // intervention so it shows up on the dashboard and micro-breaks page.
  let intervention = null;
  if (reply.suggestBreak) {
    const lib = BREAK_LIBRARY[reply.suggestBreak.kind];
    const match = lib.find((b) => b.title === reply.suggestBreak!.title) ?? lib[0];
    intervention = createIntervention(user.id, {
      kind: reply.suggestBreak.kind,
      title: match.title,
      detail: match.detail,
      durationSec: match.durationSec,
      triggerNote: "Suggested by Vesper during a conversation",
    });
  }

  return ok({ userMessage, assistantMessage, intervention }, 201);
});
