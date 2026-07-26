"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Lightbulb,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { PageHeader } from "@/components/shared";
import { OfflineBanner, offlineFetch } from "@/components/offline";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/local-time";
import { useSyncedState } from "@/lib/use-synced-state";
import type { Memory, MemoryKind } from "@/lib/types";

const KINDS: {
  value: MemoryKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  blurb: string;
}[] = [
  {
    value: "trigger",
    label: "Triggers",
    icon: Zap,
    tone: "bg-amber-500/12 text-amber-300 border-amber-500/25",
    blurb: "Situations that reliably raise your stress",
  },
  {
    value: "strategy",
    label: "What helps",
    icon: Lightbulb,
    tone: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
    blurb: "Things that have actually worked for you",
  },
  {
    value: "preference",
    label: "Preferences",
    icon: Settings2,
    tone: "bg-vesper-500/12 text-vesper-300 border-vesper-500/25",
    blurb: "How you want to be spoken to",
  },
  {
    value: "person",
    label: "People",
    icon: Users,
    tone: "bg-sky-500/12 text-sky-300 border-sky-500/25",
    blurb: "Who matters in your support network",
  },
  {
    value: "milestone",
    label: "Milestones",
    icon: Trophy,
    tone: "bg-indigo-500/12 text-indigo-300 border-indigo-500/25",
    blurb: "Wins worth referring back to",
  },
];

const BLANK = { kind: "strategy" as MemoryKind, label: "", detail: "", weight: 2 };

export function MemoryView({ memories }: { memories: Memory[] }) {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useSyncedState(memories);
  const [tab, setTab] = React.useState<MemoryKind | "all">("all");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Memory | null>(null);
  const [draft, setDraft] = React.useState(BLANK);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Memory | null>(null);

  const shown = tab === "all" ? items : items.filter((m) => m.kind === tab);

  function openEditor(memory?: Memory) {
    if (memory) {
      setEditing(memory);
      setDraft({
        kind: memory.kind,
        label: memory.label,
        detail: memory.detail,
        weight: memory.weight,
      });
    } else {
      setEditing(null);
      setDraft(BLANK);
    }
    setEditorOpen(true);
  }

  async function save() {
    if (!draft.label.trim()) return toast("Add a short label", "error");
    setSaving(true);

    const res = await offlineFetch(editing ? `/api/memories/${editing.id}` : "/api/memories", {
      method: editing ? "PATCH" : "POST",
      body: {
        kind: draft.kind,
        label: draft.label.trim(),
        detail: draft.detail.trim(),
        weight: draft.weight,
      },
      label: editing ? "update memory" : "new memory",
    });

    setSaving(false);
    if (!res.ok) return toast(res.error ?? "Couldn't save", "error");

    setEditorOpen(false);
    setEditing(null);
    setDraft(BLANK);
    toast(editing ? "Memory updated" : "Memory added");
    if (!res.queued) router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = items;
    setItems((list) => list.filter((m) => m.id !== id));
    setDeleting(null);
    const res = await offlineFetch(`/api/memories/${id}`, {
      method: "DELETE",
      label: "forget memory",
    });
    if (!res.ok) {
      setItems(prev);
      return toast("Couldn't delete", "error");
    }
    toast("Vesper has forgotten that");
    if (!res.queued) router.refresh();
  }

  const counts = Object.fromEntries(
    KINDS.map((k) => [k.value, items.filter((m) => m.kind === k.value).length]),
  ) as Record<MemoryKind, number>;

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title="What Vesper remembers"
        description="Every one of these shapes how the companion responds. Nothing is hidden — edit or delete anything, any time."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Add memory
          </Button>
        }
      />

      <Card className="mb-6 border-vesper-500/20 bg-vesper-600/[0.05] p-4">
        <div className="flex gap-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-vesper-500/15 text-vesper-300">
            <Brain className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-medium text-white">Why this page exists</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              An AI that remembers you should let you see the memory. Vesper builds these notes as
              you talk — the heavier the weight, the more it leans on them. If something is wrong or
              you&apos;d rather it forgot, remove it and it&apos;s gone for good.
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { value: "all" as const, label: "All", count: items.length },
          ...KINDS.map((k) => ({ value: k.value, label: k.label, count: counts[k.value] })),
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4 flex-wrap"
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={items.length === 0 ? "No memories yet" : "Nothing in this category"}
          description={
            items.length === 0
              ? "As you talk with Vesper it'll note your triggers, what helps, and how you like to be spoken to. You can also add notes yourself."
              : "Vesper hasn't picked up anything in this category yet."
          }
          action={
            <Button onClick={() => openEditor()}>
              <Plus className="h-4 w-4" />
              Add one manually
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {(tab === "all" ? KINDS : KINDS.filter((k) => k.value === tab)).map((kind) => {
            const group = shown.filter((m) => m.kind === kind.value);
            if (!group.length) return null;
            const Icon = kind.icon;
            return (
              <section key={kind.value}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span
                    className={cn("grid h-7 w-7 place-items-center rounded-lg border", kind.tone)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-white">{kind.label}</h3>
                    <p className="text-[11px] text-ink-500">{kind.blurb}</p>
                  </div>
                  <span className="h-px flex-1 bg-ink-800" />
                </div>
                <ul className="space-y-2">
                  {group.map((m) => (
                    <li key={m.id}>
                      <Card className="group flex items-start gap-3.5 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-medium capitalize text-white">{m.label}</h4>
                            <Badge
                              tone={m.weight >= 3 ? "violet" : m.weight >= 2 ? "sky" : "neutral"}
                            >
                              {m.weight >= 3 ? "strong" : m.weight >= 2 ? "moderate" : "light"}
                            </Badge>
                          </div>
                          {m.detail && (
                            <p className="mt-1 text-xs leading-relaxed text-ink-400">{m.detail}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="h-1 w-24 overflow-hidden rounded-full bg-ink-800">
                              <span
                                className="block h-full rounded-full bg-vesper-500/70"
                                style={{ width: `${Math.min(100, (m.weight / 5) * 100)}%` }}
                              />
                            </span>
                            <span className="text-[10px] text-ink-600">
                              last referenced <RelativeTime value={m.lastSeenAt} />
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => openEditor(m)}
                            aria-label="Edit memory"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-white focus-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleting(m)}
                            aria-label="Forget this"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-rose-300 focus-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Edit memory" : "Add a memory"}
        description="Tell Vesper something it should keep in mind about you."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Add memory"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="m-kind">Type</Label>
            <Select
              id="m-kind"
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as MemoryKind }))}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label} — {k.blurb.toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="m-label" hint="short and specific">
              Label
            </Label>
            <Input
              id="m-label"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="walking helps"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="m-detail" hint="optional">
              Detail
            </Label>
            <Textarea
              id="m-detail"
              rows={3}
              value={draft.detail}
              onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))}
              placeholder="A 20-minute walk lifts my mood more than anything else I've tried."
            />
          </div>
          <div>
            <Label>
              How much weight should this carry?{" "}
              <span className="text-white">
                {draft.weight >= 3 ? "Strong" : draft.weight >= 2 ? "Moderate" : "Light"}
              </span>
            </Label>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={draft.weight}
              onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
              style={{ ["--pct" as string]: `${((draft.weight - 0.5) / 4.5) * 100}%` }}
              className="w-full"
            />
            <p className="mt-1.5 text-[11px] text-ink-500">
              Heavier memories get referenced more often in conversation.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Forget this?"
        description={`Vesper will stop using "${deleting?.label}" in conversations. This can't be undone, though it may notice the pattern again over time.`}
        confirmLabel="Forget it"
      />
    </div>
  );
}
