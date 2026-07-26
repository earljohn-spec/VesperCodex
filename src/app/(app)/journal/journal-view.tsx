"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookHeart,
  CloudOff,
  Flame,
  Mic,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Type,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { LineChart } from "@/components/charts";
import { EmotionChip, MoodDot, PageHeader, StatCard } from "@/components/shared";
import { VoiceRecorder } from "@/components/voice-recorder";
import { OfflineBanner, offlineFetch, useOffline } from "@/components/offline";
import { cn, formatDate, formatTime, relativeTime } from "@/lib/utils";
import { EMOTION_TAGS, type EmotionTag, type JournalEntry } from "@/lib/types";
import type { JournalStats } from "@/lib/repos/journal";

/** Keyword → emotion, used to pre-tag an entry as you write or speak it. */
const EMOTION_HINTS: [EmotionTag, RegExp][] = [
  ["anxious", /\b(anxious|anxiety|nervous|worried|worry|dread|on edge|panic)\b/i],
  ["overwhelmed", /\b(overwhelm|too much|drowning|swamped|can'?t keep up|underwater|buried)\b/i],
  ["tired", /\b(tired|exhaust|drained|knackered|shattered|fatigue|running on)\b/i],
  ["frustrated", /\b(frustrat|annoyed|irritat|angry|snapped|pissed)\b/i],
  ["sad", /\b(sad|down|low|crying|cried|tearful|miserable|heavy)\b/i],
  ["numb", /\b(numb|flat|empty|nothing|disconnected|going through the motions)\b/i],
  ["lonely", /\b(lonely|alone|isolated|no one|nobody)\b/i],
  ["restless", /\b(restless|can'?t settle|fidget|wired|can'?t sleep|awake)\b/i],
  ["calm", /\b(calm|settled|peaceful|quiet|steady|centred|centered)\b/i],
  ["grateful", /\b(grateful|thankful|appreciate|lucky)\b/i],
  ["hopeful", /\b(hopeful|optimistic|looking forward|better|turning a corner)\b/i],
  ["content", /\b(content|fine|okay|alright|good enough|comfortable)\b/i],
  ["energized", /\b(energi[sz]ed|energy|motivated|buzzing|fresh|alive)\b/i],
  ["focused", /\b(focus|clear|productive|in the zone|dialled|dialed)\b/i],
  ["proud", /\b(proud|achieved|managed to|nailed|shipped|finished|got the)\b/i],
  ["relieved", /\b(relieved|relief|weight off|over with|finally done)\b/i],
];

function suggestEmotions(text: string): EmotionTag[] {
  const found: EmotionTag[] = [];
  for (const [tag, re] of EMOTION_HINTS) {
    if (re.test(text) && !found.includes(tag)) found.push(tag);
  }
  return found.slice(0, 4);
}

const BLANK = {
  title: "",
  body: "",
  moodScore: 6,
  energyScore: 6,
  emotions: [] as EmotionTag[],
  source: "text" as "text" | "voice",
  transcriptMs: null as number | null,
};

type Draft = typeof BLANK;

interface Props {
  entries: JournalEntry[];
  stats: JournalStats;
  trend: { date: string; mood: number | null; energy: number | null; count: number }[];
  emotions: { emotion: string; count: number; positive: boolean }[];
  openNew?: boolean;
  focusEntry?: string;
}

export function JournalView({ entries, stats, trend, emotions, openNew, focusEntry }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { offline } = useOffline();

  const [items, setItems] = React.useState(entries);
  const [editorOpen, setEditorOpen] = React.useState(!!openNew);
  const [editing, setEditing] = React.useState<JournalEntry | null>(null);
  const [draft, setDraft] = React.useState<Draft>(BLANK);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<JournalEntry | null>(null);
  const [viewing, setViewing] = React.useState<JournalEntry | null>(null);
  const [search, setSearch] = React.useState("");
  const [sourceTab, setSourceTab] = React.useState<"all" | "text" | "voice">("all");
  const [emotionFilter, setEmotionFilter] = React.useState<string>("");
  const [autoTagged, setAutoTagged] = React.useState<EmotionTag[]>([]);

  React.useEffect(() => setItems(entries), [entries]);

  React.useEffect(() => {
    if (focusEntry) {
      const found = entries.find((e) => e.id === focusEntry);
      if (found) setViewing(found);
    }
  }, [focusEntry, entries]);

  /* ------------------------------- filtering ------------------------------ */

  const filtered = items.filter((e) => {
    if (sourceTab !== "all" && e.source !== sourceTab) return false;
    if (emotionFilter && !e.emotions.includes(emotionFilter as EmotionTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filtered) {
      const key = formatDate(e.entryDate, { weekday: "long", month: "long", day: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  /* -------------------------------- actions ------------------------------- */

  function openEditor(entry?: JournalEntry) {
    if (entry) {
      setEditing(entry);
      setDraft({
        title: entry.title,
        body: entry.body,
        moodScore: entry.moodScore,
        energyScore: entry.energyScore,
        emotions: entry.emotions,
        source: entry.source,
        transcriptMs: entry.transcriptMs,
      });
    } else {
      setEditing(null);
      setDraft(BLANK);
    }
    setAutoTagged([]);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setDraft(BLANK);
    setAutoTagged([]);
    if (openNew) router.replace("/journal", { scroll: false });
  }

  /** Re-run auto-tagging as the body changes, without stomping manual picks. */
  function updateBody(body: string, viaVoice = false) {
    setDraft((d) => {
      const suggested = suggestEmotions(body);
      const manual = d.emotions.filter((e) => !autoTagged.includes(e));
      const merged = [...new Set([...manual, ...suggested])].slice(0, 6);
      return { ...d, body, emotions: merged, source: viaVoice ? "voice" : d.source };
    });
    setAutoTagged(suggestEmotions(body));
  }

  async function save() {
    if (!draft.body.trim() && !draft.title.trim()) {
      toast("Write or say something first", "error");
      return;
    }
    setSaving(true);

    const payload = {
      title: draft.title.trim() || draft.body.trim().split(/[.!?\n]/)[0].slice(0, 60),
      body: draft.body.trim(),
      moodScore: draft.moodScore,
      energyScore: draft.energyScore,
      emotions: draft.emotions,
      source: draft.source,
      transcriptMs: draft.transcriptMs,
      ...(editing ? {} : { synced: !offline }),
    };

    // optimistic insert/update
    const optimistic: JournalEntry = {
      id: editing?.id ?? `tmp_${Date.now()}`,
      userId: editing?.userId ?? "",
      ...payload,
      entryDate: editing?.entryDate ?? new Date().toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: !offline,
      emotions: draft.emotions,
    };
    const prev = items;
    setItems((list) =>
      editing ? list.map((e) => (e.id === editing.id ? optimistic : e)) : [optimistic, ...list],
    );
    closeEditor();

    const res = await offlineFetch(editing ? `/api/journal/${editing.id}` : "/api/journal", {
      method: editing ? "PATCH" : "POST",
      body: payload,
      label: editing ? "update entry" : "new entry",
    });

    setSaving(false);
    if (!res.ok) {
      setItems(prev);
      toast(res.error ?? "Couldn't save that entry", "error");
      return;
    }
    if (res.queued) {
      toast("Saved offline — syncs when you reconnect", "info");
    } else {
      toast(editing ? "Entry updated" : "Entry saved");
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = items;
    setItems((list) => list.filter((e) => e.id !== id));
    setDeleting(null);
    setViewing(null);

    const res = await offlineFetch(`/api/journal/${id}`, { method: "DELETE", label: "delete entry" });
    if (!res.ok) {
      setItems(prev);
      toast("Couldn't delete that", "error");
      return;
    }
    toast(res.queued ? "Deletion queued" : "Entry deleted", res.queued ? "info" : "success");
    if (!res.queued) router.refresh();
  }

  const moodSeries = trend.map((t) => ({ date: t.date, value: t.mood }));
  const energySeries = trend.map((t) => ({ date: t.date, value: t.energy }));

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title="Journal"
        description="Type it or speak it. Vesper tags the emotions and watches the trend so you don't have to."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            New entry
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mood · 7-day avg"
          value={stats.avgMood7 ? stats.avgMood7.toFixed(1) : "—"}
          unit="/ 10"
          delta={stats.moodDelta || undefined}
          deltaLabel="vs prior week"
          icon={TrendingUp}
        />
        <StatCard
          label="Entries"
          value={stats.total}
          icon={BookHeart}
          tone="sky"
          footer={`${stats.last30} in the last 30 days`}
        />
        <StatCard
          label="Streak"
          value={stats.streak}
          unit={stats.streak === 1 ? "day" : "days"}
          icon={Flame}
          tone="amber"
          footer={stats.streak > 0 ? "Keep it gentle, not perfect" : "One entry starts it"}
        />
        <StatCard
          label="By voice"
          value={`${stats.voiceShare}%`}
          icon={Mic}
          tone="violet"
          footer={stats.pendingSync > 0 ? `${stats.pendingSync} pending sync` : "All entries synced"}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Mood & energy" subtitle="Daily averages, last 30 days" icon={TrendingUp} />
          <div className="px-3 pb-4">
            <LineChart
              series={moodSeries}
              height={210}
              min={1}
              max={10}
              bands={[
                { from: 1, to: 4, color: "rgba(248,113,113,0.05)" },
                { from: 7, to: 10, color: "rgba(52,211,153,0.05)" },
              ]}
              formatValue={(v) => `Mood ${v.toFixed(1)}/10`}
            />
          </div>
          <div className="border-t border-ink-800 px-3 pb-3 pt-2">
            <p className="px-2 pb-1 text-[11px] text-ink-500">Energy</p>
            <LineChart
              series={energySeries}
              height={96}
              min={1}
              max={10}
              color="#38bdf8"
              fillFrom="rgba(14,165,233,0.22)"
              formatValue={(v) => `Energy ${v.toFixed(1)}/10`}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Emotion patterns"
            subtitle="Tap to filter · last 30 days"
            icon={Sparkles}
            action={
              emotionFilter ? (
                <Button variant="ghost" size="sm" onClick={() => setEmotionFilter("")}>
                  Clear
                </Button>
              ) : undefined
            }
          />
          <div className="px-5 pb-5">
            {emotions.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No tags yet"
                description="Emotions are detected automatically as you write."
                className="py-8"
              />
            ) : (
              <div className="space-y-2.5">
                {emotions.slice(0, 9).map((e) => {
                  const max = emotions[0].count;
                  return (
                    <button
                      key={e.emotion}
                      onClick={() => setEmotionFilter(emotionFilter === e.emotion ? "" : e.emotion)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors focus-ring",
                        emotionFilter === e.emotion ? "bg-vesper-500/12" : "hover:bg-ink-800/50",
                      )}
                    >
                      <span className="w-20 shrink-0 truncate text-xs capitalize text-ink-200">
                        {e.emotion}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-all duration-700",
                            e.positive ? "bg-emerald-500/70" : "bg-amber-500/70",
                          )}
                          style={{ width: `${(e.count / max) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-ink-400">
                        {e.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------------- list ------------------------------- */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { value: "all", label: "All", count: items.length },
            { value: "text", label: "Written", count: items.filter((e) => e.source === "text").length },
            { value: "voice", label: "Voice", count: items.filter((e) => e.source === "voice").length },
          ]}
          value={sourceTab}
          onChange={setSourceTab}
        />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your entries"
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {emotionFilter && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
          Filtered by
          <EmotionChip emotion={emotionFilter} size="sm" />
          <button
            onClick={() => setEmotionFilter("")}
            className="text-vesper-300 hover:text-vesper-200 focus-ring rounded"
          >
            clear
          </button>
        </div>
      )}

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={BookHeart}
            title={items.length === 0 ? "Your journal is empty" : "Nothing matches those filters"}
            description={
              items.length === 0
                ? "Start with one line about how today actually went. Voice notes count, and it works offline."
                : "Try clearing the search or switching tabs."
            }
            action={
              items.length === 0 ? (
                <Button onClick={() => openEditor()}>
                  <Plus className="h-4 w-4" />
                  Write your first entry
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setEmotionFilter("");
                    setSourceTab("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, dayEntries]) => (
              <div key={day}>
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-medium text-ink-400">
                  {day}
                  <span className="h-px flex-1 bg-ink-800" />
                  <span className="text-ink-600">
                    {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"}
                  </span>
                </h3>
                <ul className="space-y-2.5">
                  {dayEntries.map((entry) => (
                    <li key={entry.id}>
                      <div className="group card flex gap-4 p-4 transition-all hover:border-ink-600">
                        <button
                          onClick={() => setViewing(entry)}
                          className="flex min-w-0 flex-1 gap-4 text-left focus-ring rounded-lg"
                        >
                          <MoodDot score={entry.moodScore} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-medium text-white">
                                {entry.title || "Untitled entry"}
                              </h4>
                              <Badge tone={entry.source === "voice" ? "sky" : "neutral"}>
                                {entry.source === "voice" ? (
                                  <>
                                    <Mic className="h-2.5 w-2.5" />
                                    voice
                                  </>
                                ) : (
                                  <>
                                    <Type className="h-2.5 w-2.5" />
                                    written
                                  </>
                                )}
                              </Badge>
                              {!entry.synced && (
                                <Badge tone="amber">
                                  <CloudOff className="h-2.5 w-2.5" />
                                  pending
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                              {entry.body || "No details written."}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-ink-500">
                                {formatTime(entry.entryDate)} · energy {entry.energyScore}/10
                              </span>
                              {entry.emotions.slice(0, 4).map((em) => (
                                <EmotionChip key={em} emotion={em} size="sm" />
                              ))}
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => openEditor(entry)}
                            aria-label="Edit entry"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-white focus-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleting(entry)}
                            aria-label="Delete entry"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-rose-300 focus-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------ editor ------------------------------ */}
      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? "Edit entry" : "How are you doing?"}
        description={
          editing
            ? "Update how you recorded this moment."
            : "No wrong answers. A sentence is plenty."
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Save entry"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {!editing && (
            <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
              <VoiceRecorder
                onTranscript={(text) => updateBody(text, true)}
                onDurationChange={(ms) => setDraft((d) => ({ ...d, transcriptMs: ms }))}
              />
            </div>
          )}

          <div>
            <Label htmlFor="j-title" hint="optional">
              Title
            </Label>
            <Input
              id="j-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Give this moment a name"
            />
          </div>

          <div>
            <Label htmlFor="j-body">What&apos;s going on?</Label>
            <Textarea
              id="j-body"
              rows={6}
              value={draft.body}
              onChange={(e) => updateBody(e.target.value)}
              placeholder="The honest version — nobody else reads this."
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>
                Mood <span className="text-white">{draft.moodScore}/10</span>
              </Label>
              <input
                type="range"
                min={1}
                max={10}
                value={draft.moodScore}
                onChange={(e) => setDraft((d) => ({ ...d, moodScore: Number(e.target.value) }))}
                style={{ ["--pct" as string]: `${((draft.moodScore - 1) / 9) * 100}%` }}
                className="w-full"
                aria-label="Mood score"
              />
              <div className="mt-1 flex justify-between text-[10px] text-ink-500">
                <span>Hard</span>
                <span>Great</span>
              </div>
            </div>
            <div>
              <Label>
                Energy <span className="text-white">{draft.energyScore}/10</span>
              </Label>
              <input
                type="range"
                min={1}
                max={10}
                value={draft.energyScore}
                onChange={(e) => setDraft((d) => ({ ...d, energyScore: Number(e.target.value) }))}
                style={{ ["--pct" as string]: `${((draft.energyScore - 1) / 9) * 100}%` }}
                className="w-full"
                aria-label="Energy score"
              />
              <div className="mt-1 flex justify-between text-[10px] text-ink-500">
                <span>Empty</span>
                <span>Full</span>
              </div>
            </div>
          </div>

          <div>
            <Label hint={autoTagged.length ? "auto-detected, tap to adjust" : "tap any that fit"}>
              Emotions
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOTION_TAGS.map((tag) => (
                <EmotionChip
                  key={tag}
                  emotion={tag}
                  selected={draft.emotions.includes(tag)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      emotions: d.emotions.includes(tag)
                        ? d.emotions.filter((x) => x !== tag)
                        : [...d.emotions, tag].slice(0, 6),
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ------------------------------ viewer ------------------------------ */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title || "Journal entry"}
        description={
          viewing
            ? `${formatDate(viewing.entryDate, { weekday: "long", month: "long", day: "numeric" })} at ${formatTime(viewing.entryDate)} · ${relativeTime(viewing.entryDate)}`
            : undefined
        }
        size="lg"
        footer={
          viewing && (
            <>
              <Button variant="ghost" onClick={() => setDeleting(viewing)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                onClick={() => {
                  const e = viewing;
                  setViewing(null);
                  openEditor(e);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <MoodDot score={viewing.moodScore} size={44} />
              <div className="text-xs text-ink-400">
                <p>
                  Mood <span className="text-white">{viewing.moodScore}/10</span> · Energy{" "}
                  <span className="text-white">{viewing.energyScore}/10</span>
                </p>
                <p className="mt-0.5">
                  {viewing.source === "voice" ? "Voice note" : "Written"}
                  {viewing.transcriptMs
                    ? ` · ${Math.round(viewing.transcriptMs / 1000)}s recording`
                    : ""}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-100">
              {viewing.body || "No details written."}
            </p>
            {viewing.emotions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-ink-800 pt-4">
                {viewing.emotions.map((em) => (
                  <EmotionChip key={em} emotion={em} />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this entry?"
        description="This permanently removes the entry and its mood data from your trends. This can't be undone."
      />
    </div>
  );
}
