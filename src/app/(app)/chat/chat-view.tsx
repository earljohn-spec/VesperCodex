"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Brain,
  MessageCircleHeart,
  Mic,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wind,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Textarea,
  Tooltip,
  useToast,
} from "@/components/ui";
import { RichText } from "@/components/shared";
import { BreathingPlayer } from "@/components/breathing";
import { OfflineBanner, useOffline } from "@/components/offline";
import { cn, initials, relativeTime } from "@/lib/utils";
import { useSyncedState } from "@/lib/use-synced-state";
import type { Conversation, Intervention, Message, User } from "@/lib/types";

interface Props {
  user: User;
  conversations: Conversation[];
  activeId?: string;
  initialMessages: Message[];
  prompt: string;
  starters: string[];
  contextChips: {
    mood: number;
    moodDelta: number;
    stress: number;
    hrvDelta: number;
    streak: number;
    memories: number;
    habitsDone: number;
    habitsDue: number;
  };
}

export function ChatView({
  user,
  conversations: initialConversations,
  activeId: initialActiveId,
  initialMessages,
  prompt,
  starters,
  contextChips,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { offline } = useOffline();

  const [conversations, setConversations] = useSyncedState(initialConversations);
  const [activeId, setActiveId] = React.useState(initialActiveId);
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleting, setDeleting] = React.useState<Conversation | null>(null);
  const [player, setPlayer] = React.useState<Intervention | null>(null);
  const [listOpen, setListOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Re-sync the open thread when the server sends a different conversation
  // (adjust-state-on-prop-change, not an effect).
  const [prevThread, setPrevThread] = React.useState({ initialMessages, initialActiveId });
  if (
    prevThread.initialMessages !== initialMessages ||
    prevThread.initialActiveId !== initialActiveId
  ) {
    setPrevThread({ initialMessages, initialActiveId });
    setMessages(initialMessages);
    setActiveId(initialActiveId);
  }

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const filtered = search
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          (c.lastMessage ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  /* ------------------------------ actions ------------------------------ */

  async function selectConversation(id: string) {
    setActiveId(id);
    setListOpen(false);
    setMessages([]);
    setThinking(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      router.replace(`/chat?c=${id}`, { scroll: false });
    } catch {
      toast("Couldn't load that conversation", "error");
    } finally {
      setThinking(false);
    }
  }

  async function newConversation(seed?: string) {
    if (offline) {
      toast("New conversations need a connection — journalling still works offline", "info");
      return;
    }
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return toast("Couldn't start a conversation", "error");
    const { conversation } = await res.json();
    setConversations((c) => [conversation, ...c]);
    setActiveId(conversation.id);
    setMessages([]);
    setListOpen(false);
    router.replace(`/chat?c=${conversation.id}`, { scroll: false });
    if (seed) setTimeout(() => void send(seed, conversation.id), 60);
    else inputRef.current?.focus();
  }

  async function send(text: string, convId?: string) {
    const content = text.trim();
    const targetId = convId ?? activeId;
    if (!content || thinking) return;
    if (!targetId) return newConversation(content);

    if (offline) {
      toast("Vesper needs a connection to reply. Your journal still works offline.", "info");
      return;
    }

    // optimistic user message
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      conversationId: targetId,
      userId: user.id,
      role: "user",
      content,
      strategy: null,
      contextUsed: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch(`/api/conversations/${targetId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      if (data.intervention) setPlayer(data.intervention);
      // refresh the sidebar list titles/ordering
      const list = await fetch("/api/conversations").then((r) => r.json());
      setConversations(list.conversations ?? []);
      router.refresh();
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(content);
      toast("Vesper couldn't respond. Try again in a moment.", "error");
    } finally {
      setThinking(false);
    }
  }

  async function patchConversation(id: string, patch: Partial<Conversation>) {
    const prev = conversations;
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setConversations(prev);
      toast("Couldn't update that", "error");
      return;
    }
    if (patch.archived) {
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeId === id) {
        const next = conversations.find((c) => c.id !== id);
        setActiveId(next?.id);
        if (next) void selectConversation(next.id);
        else setMessages([]);
      }
      toast("Archived");
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = conversations;
    setConversations((cs) => cs.filter((c) => c.id !== id));
    setDeleting(null);
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setConversations(prev);
      return toast("Couldn't delete", "error");
    }
    if (activeId === id) {
      const next = prev.find((c) => c.id !== id);
      setActiveId(next?.id);
      if (next) void selectConversation(next.id);
      else setMessages([]);
    }
    toast("Conversation deleted");
    router.refresh();
  }

  async function submitRename(id: string) {
    const title = renameValue.trim();
    setRenaming(null);
    if (!title) return;
    await patchConversation(id, { title });
  }

  /* -------------------------------- render ------------------------------- */

  const chipItems = [
    contextChips.mood > 0 && {
      label: `Mood ${contextChips.mood.toFixed(1)}`,
      sub: contextChips.moodDelta ? `${contextChips.moodDelta > 0 ? "+" : ""}${contextChips.moodDelta.toFixed(1)}` : undefined,
      tone: contextChips.moodDelta >= 0 ? ("emerald" as const) : ("amber" as const),
    },
    { label: `Stress ${contextChips.stress}`, tone: contextChips.stress >= 65 ? ("rose" as const) : ("sky" as const) },
    contextChips.hrvDelta !== 0 && {
      label: `HRV ${contextChips.hrvDelta > 0 ? "+" : ""}${contextChips.hrvDelta.toFixed(0)}ms`,
      tone: contextChips.hrvDelta >= 0 ? ("emerald" as const) : ("amber" as const),
    },
    contextChips.streak > 0 && { label: `${contextChips.streak}d streak`, tone: "violet" as const },
    contextChips.memories > 0 && { label: `${contextChips.memories} memories`, tone: "violet" as const },
  ].filter(Boolean) as { label: string; sub?: string; tone: "emerald" | "amber" | "rose" | "sky" | "violet" }[];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen lg:flex-row">
      {/* conversation list */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-b border-ink-800 lg:w-72 lg:border-b-0 lg:border-r",
          listOpen ? "flex" : "hidden lg:flex",
        )}
      >
        <div className="border-b border-ink-800 p-3">
          <Button className="w-full" onClick={() => newConversation()} disabled={offline}>
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-500">
              {search ? "No conversations match that." : "No conversations yet."}
            </p>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group relative rounded-xl border transition-all",
                  activeId === c.id
                    ? "border-vesper-500/40 bg-vesper-500/[0.09]"
                    : "border-transparent hover:border-ink-700 hover:bg-ink-800/50",
                )}
              >
                {renaming === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitRename(c.id);
                    }}
                    className="p-2"
                  >
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void submitRename(c.id)}
                      className="h-8 text-xs"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => selectConversation(c.id)}
                    className="w-full px-3 py-2.5 text-left focus-ring rounded-xl"
                  >
                    <div className="flex items-center gap-1.5">
                      {c.pinned && <Pin className="h-3 w-3 shrink-0 fill-vesper-400 text-vesper-400" />}
                      <span
                        className={cn(
                          "truncate text-xs font-medium",
                          activeId === c.id ? "text-white" : "text-ink-200",
                        )}
                      >
                        {c.title}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 pr-14 text-[11px] text-ink-500">
                      {c.lastMessage || c.summary || "No messages yet"}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-600">
                      {relativeTime(c.updatedAt)} · {c.messageCount ?? 0} messages
                    </p>
                  </button>
                )}

                <div className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
                  <Tooltip label={c.pinned ? "Unpin" : "Pin"}>
                    <button
                      onClick={() => patchConversation(c.id, { pinned: !c.pinned })}
                      className="rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-vesper-300 focus-ring"
                    >
                      <Pin className={cn("h-3 w-3", c.pinned && "fill-current")} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Rename">
                    <button
                      onClick={() => {
                        setRenaming(c.id);
                        setRenameValue(c.title);
                      }}
                      className="rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-white focus-ring"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Archive">
                    <button
                      onClick={() => patchConversation(c.id, { archived: true })}
                      className="rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-white focus-ring"
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <button
                      onClick={() => setDeleting(c)}
                      className="rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-rose-300 focus-ring"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-3 lg:px-6">
          <button
            onClick={() => setListOpen((o) => !o)}
            className="rounded-lg border border-ink-700 p-1.5 text-ink-300 hover:bg-ink-800 lg:hidden focus-ring"
            aria-label="Toggle conversation list"
          >
            <MessageCircleHeart className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">
              {active?.title ?? "Vesper"}
            </h1>
            <p className="truncate text-[11px] text-ink-500">
              {active?.summary || "Grounded in your mood history, biometrics, and what's worked before"}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {chipItems.slice(0, 4).map((chip) => (
              <Badge key={chip.label} tone={chip.tone}>
                {chip.label}
                {chip.sub && <span className="opacity-70">{chip.sub}</span>}
              </Badge>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-3xl">
            <OfflineBanner />

            {messages.length === 0 && !thinking ? (
              <div className="py-6">
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-vesper-500/12 text-vesper-300">
                    <span className="absolute inset-0 rounded-2xl bg-vesper-500/10 animate-pulse-ring" />
                    <Sparkles className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {active ? "Say what's on your mind" : "Start a conversation"}
                  </h2>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-400">{prompt}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {chipItems.map((chip) => (
                      <Badge key={chip.label} tone={chip.tone}>
                        {chip.label}
                        {chip.sub && <span className="opacity-70">{chip.sub}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => (active ? void send(s) : void newConversation(s))}
                      disabled={offline}
                      className="rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3 text-left text-sm text-ink-200 transition-all hover:border-vesper-500/40 hover:bg-ink-800/60 hover:text-white disabled:opacity-50 focus-ring"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-5">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn("flex gap-3 animate-slide-up", m.role === "user" && "flex-row-reverse")}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        m.role === "assistant"
                          ? "bg-vesper-500/15 text-vesper-300"
                          : "text-white ring-1 ring-ink-700",
                      )}
                      style={
                        m.role === "user"
                          ? {
                              background: `linear-gradient(140deg, hsl(${user.avatarHue} 70% 58%), hsl(${(user.avatarHue + 45) % 360} 72% 44%))`,
                            }
                          : undefined
                      }
                    >
                      {m.role === "assistant" ? <Sparkles className="h-4 w-4" /> : initials(user.name)}
                    </span>

                    <div className={cn("min-w-0 max-w-[85%]", m.role === "user" && "items-end")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          m.role === "assistant"
                            ? "border border-ink-800 bg-ink-900/70 text-ink-100"
                            : "bg-vesper-600 text-white",
                        )}
                      >
                        <RichText text={m.content} />
                      </div>
                      <div
                        className={cn(
                          "mt-1.5 flex flex-wrap items-center gap-1.5 px-1",
                          m.role === "user" && "justify-end",
                        )}
                      >
                        <span className="text-[10px] text-ink-600">{relativeTime(m.createdAt)}</span>
                        {m.strategy && (
                          <Badge tone="violet">
                            <Wind className="h-2.5 w-2.5" />
                            {m.strategy}
                          </Badge>
                        )}
                        {m.contextUsed.length > 0 && (
                          <Tooltip label={`Referenced: ${m.contextUsed.join(", ")}`}>
                            <Badge tone="neutral">
                              <Brain className="h-2.5 w-2.5" />
                              {m.contextUsed.length} context
                            </Badge>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </li>
                ))}

                {thinking && (
                  <li className="flex gap-3 animate-fade-in">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vesper-500/15 text-vesper-300">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900/70 px-4 py-3.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-vesper-400"
                          style={{ animationDelay: `${i * 140}ms` }}
                        />
                      ))}
                      <span className="ml-1 text-[11px] text-ink-500">
                        reading your patterns…
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-ink-800 bg-ink-950/60 p-3 backdrop-blur lg:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <div className="relative flex-1">
              <Textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 170)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder={
                  offline
                    ? "Offline — the companion needs a connection"
                    : "Tell Vesper what's going on…"
                }
                disabled={offline}
                className="max-h-44 min-h-[2.85rem] py-3 pr-11"
              />
              <Tooltip label="Voice input is available in the journal">
                <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg text-ink-600">
                  <Mic className="h-4 w-4" />
                </span>
              </Tooltip>
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-[2.85rem] w-[2.85rem] rounded-xl"
              disabled={!input.trim() || thinking || offline}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10.5px] leading-relaxed text-ink-600">
            Vesper offers wellbeing support, not therapy or crisis care. In an emergency contact
            your local services or a crisis line.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this conversation?"
        description={`"${deleting?.title}" and all its messages will be permanently removed. Any memories Vesper formed will stay.`}
      />

      {player && (
        <BreathingPlayer
          open={!!player}
          onClose={() => setPlayer(null)}
          title={player.title}
          detail={player.detail}
          kind={player.kind}
          durationSec={player.durationSec}
          onComplete={async () => {
            await fetch(`/api/breaks/${player.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });
            toast("Logged. That counts.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
