import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listConversations, listMessages } from "@/lib/repos/conversations";
import { buildContext, openingPrompt, CONVERSATION_STARTERS } from "@/lib/companion";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Companion" };
export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { c } = await searchParams;
  const conversations = listConversations(user.id);
  const activeId = c && conversations.some((x) => x.id === c) ? c : conversations[0]?.id;
  const messages = activeId ? listMessages(user.id, activeId) : [];
  const ctx = buildContext(user);

  return (
    <ChatView
      user={user}
      conversations={conversations}
      activeId={activeId}
      initialMessages={messages}
      prompt={openingPrompt(ctx)}
      starters={CONVERSATION_STARTERS}
      contextChips={{
        mood: ctx.moodAvg7,
        moodDelta: ctx.moodDelta,
        stress: ctx.stressNow,
        hrvDelta: ctx.hrvDelta,
        streak: ctx.streak,
        memories: ctx.memories.length,
        habitsDone: ctx.habitsDone,
        habitsDue: ctx.habitsDue,
      }}
    />
  );
}
