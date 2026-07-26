"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  Repeat2,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  Wind,
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
import { HeatStrip } from "@/components/charts";
import { PageHeader, StatCard } from "@/components/shared";
import { OfflineBanner, offlineFetch } from "@/components/offline";
import { cn, todayKey } from "@/lib/utils";
import type { HabitCadence, HabitWithStats } from "@/lib/types";
import type { HabitSummary } from "@/lib/repos/habits";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  footprints: Footprints,
  wind: Wind,
  moon: Moon,
  utensils: Utensils,
  dumbbell: Dumbbell,
  "notebook-pen": NotebookPen,
  droplets: Droplets,
  target: Target,
};

const COLORS: Record<string, string> = {
  violet: "bg-vesper-500/15 text-vesper-300 border-vesper-500/25",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
};

const BLANK = {
  name: "",
  description: "",
  icon: "sparkles",
  color: "violet",
  cadence: "daily" as HabitCadence,
  targetPerWeek: 7,
  reminderTime: "",
};

const CADENCE_LABEL: Record<HabitCadence, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "A few times a week",
};

export function HabitsView({
  habits,
  summary,
  openNew,
}: {
  habits: HabitWithStats[];
  summary: HabitSummary;
  openNew?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = React.useState(habits);
  const [tab, setTab] = React.useState<"active" | "archived">("active");
  const [editorOpen, setEditorOpen] = React.useState(!!openNew);
  const [editing, setEditing] = React.useState<HabitWithStats | null>(null);
  const [draft, setDraft] = React.useState(BLANK);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<HabitWithStats | null>(null);
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  React.useEffect(() => setItems(habits), [habits]);

  const active = items.filter((h) => !h.archived);
  const archived = items.filter((h) => h.archived);
  const shown = tab === "active" ? active : archived;
  const doneToday = active.filter((h) => h.completedToday).length;

  /* -------------------------------- actions ------------------------------- */

  function openEditor(habit?: HabitWithStats) {
    if (habit) {
      setEditing(habit);
      setDraft({
        name: habit.name,
        description: habit.description,
        icon: habit.icon,
        color: habit.color,
        cadence: habit.cadence,
        targetPerWeek: habit.targetPerWeek,
        reminderTime: habit.reminderTime ?? "",
      });
    } else {
      setEditing(null);
      setDraft(BLANK);
    }
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setDraft(BLANK);
    if (openNew) router.replace("/habits", { scroll: false });
  }

  async function toggle(habit: HabitWithStats) {
    const wasComplete = habit.completedToday;
    setPending((s) => new Set(s).add(habit.id));
    setItems((list) =>
      list.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              completedToday: !wasComplete,
              currentStreak: wasComplete ? Math.max(0, h.currentStreak - 1) : h.currentStreak + 1,
              completionsThisWeek: wasComplete
                ? Math.max(0, h.completionsThisWeek - 1)
                : h.completionsThisWeek + 1,
              last14: h.last14.map((d) =>
                d.date === todayKey() ? { ...d, completed: !wasComplete } : d,
              ),
            }
          : h,
      ),
    );

    const res = await offlineFetch(`/api/habits/${habit.id}/toggle`, {
      method: "POST",
      body: { date: todayKey() },
      label: `toggle ${habit.name}`,
    });

    setPending((s) => {
      const n = new Set(s);
      n.delete(habit.id);
      return n;
    });

    if (!res.ok) {
      setItems(habits);
      return toast("Couldn't save that", "error");
    }
    if (res.queued) toast("Saved offline — syncs later", "info");
    else router.refresh();
  }

  async function save() {
    if (!draft.name.trim()) return toast("Give the habit a name", "error");
    setSaving(true);

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      icon: draft.icon,
      color: draft.color,
      cadence: draft.cadence,
      targetPerWeek: draft.cadence === "weekly" ? draft.targetPerWeek : draft.cadence === "weekdays" ? 5 : 7,
      reminderTime: draft.reminderTime || null,
    };

    const res = await offlineFetch(editing ? `/api/habits/${editing.id}` : "/api/habits", {
      method: editing ? "PATCH" : "POST",
      body: payload,
      label: editing ? "update habit" : "new habit",
    });

    setSaving(false);
    if (!res.ok) return toast(res.error ?? "Couldn't save that habit", "error");

    closeEditor();
    toast(res.queued ? "Saved offline" : editing ? "Habit updated" : "Habit created");
    if (!res.queued) router.refresh();
  }

  async function setArchived(habit: HabitWithStats, archived: boolean) {
    setItems((list) => list.map((h) => (h.id === habit.id ? { ...h, archived } : h)));
    const res = await offlineFetch(`/api/habits/${habit.id}`, {
      method: "PATCH",
      body: { archived },
      label: archived ? "archive habit" : "restore habit",
    });
    if (!res.ok) {
      setItems(habits);
      return toast("Couldn't update", "error");
    }
    toast(archived ? "Habit archived" : "Habit restored");
    if (!res.queued) router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = items;
    setItems((list) => list.filter((h) => h.id !== id));
    setDeleting(null);
    const res = await offlineFetch(`/api/habits/${id}`, { method: "DELETE", label: "delete habit" });
    if (!res.ok) {
      setItems(prev);
      return toast("Couldn't delete", "error");
    }
    toast("Habit deleted");
    if (!res.queued) router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title="Habits"
        description="Small, repeatable, forgiving. Missing a day is data, not failure."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            New habit
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Done today"
          value={`${doneToday}/${active.length}`}
          icon={Check}
          tone="emerald"
          footer={
            active.length && doneToday === active.length
              ? "Everything ticked — nice"
              : `${active.length - doneToday} still open`
          }
        />
        <StatCard
          label="Best streak"
          value={summary.bestStreak}
          unit={summary.bestStreak === 1 ? "day" : "days"}
          icon={Flame}
          tone="amber"
        />
        <StatCard
          label="4-week adherence"
          value={`${summary.weeklyAdherence}%`}
          icon={Target}
          tone="violet"
          footer="Across all active habits"
        />
        <StatCard
          label="Active habits"
          value={active.length}
          icon={Repeat2}
          tone="sky"
          footer={archived.length ? `${archived.length} archived` : "Nothing archived"}
        />
      </div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { value: "active", label: "Active", count: active.length },
            { value: "archived", label: "Archived", count: archived.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <EmptyState
            icon={Repeat2}
            title={tab === "active" ? "No habits yet" : "Nothing archived"}
            description={
              tab === "active"
                ? "Start with one habit, small enough that a bad day can't break it. Two minutes counts."
                : "Habits you park will show up here. Archiving keeps the history without the pressure."
            }
            action={
              tab === "active" ? (
                <Button onClick={() => openEditor()}>
                  <Plus className="h-4 w-4" />
                  Create your first habit
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((habit) => {
              const Icon = ICONS[habit.icon] ?? Sparkles;
              const weeklyPct = Math.min(
                100,
                (habit.completionsThisWeek / habit.targetPerWeek) * 100,
              );
              return (
                <Card key={habit.id} className="group p-4">
                  <div className="flex items-start gap-3.5">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                        COLORS[habit.color] ?? COLORS.violet,
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-white">{habit.name}</h3>
                          <p className="mt-0.5 text-[11px] text-ink-500">
                            {CADENCE_LABEL[habit.cadence]}
                            {habit.cadence === "weekly" && ` · ${habit.targetPerWeek}×`}
                            {habit.reminderTime && ` · ${habit.reminderTime}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => openEditor(habit)}
                            aria-label="Edit habit"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-white focus-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setArchived(habit, !habit.archived)}
                            aria-label={habit.archived ? "Restore habit" : "Archive habit"}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-white focus-ring"
                          >
                            {habit.archived ? (
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleting(habit)}
                            aria-label="Delete habit"
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-rose-300 focus-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {habit.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-400">
                          {habit.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {habit.currentStreak > 0 && (
                          <Badge tone={habit.currentStreak >= 7 ? "amber" : "neutral"}>
                            <Flame className="h-3 w-3" />
                            {habit.currentStreak} day{habit.currentStreak === 1 ? "" : "s"}
                          </Badge>
                        )}
                        <Badge tone={habit.adherence >= 70 ? "emerald" : habit.adherence >= 45 ? "sky" : "neutral"}>
                          {habit.adherence}% adherence
                        </Badge>
                        {habit.longestStreak > habit.currentStreak && (
                          <Badge tone="neutral">best {habit.longestStreak}</Badge>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-500">
                          <span>Last 14 days</span>
                          <span>
                            {habit.completionsThisWeek}/{habit.targetPerWeek} this week
                          </span>
                        </div>
                        <HeatStrip days={habit.last14} />
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                          <div
                            className="h-full rounded-full bg-emerald-500/70 transition-all duration-700"
                            style={{ width: `${weeklyPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {!habit.archived && (
                    <button
                      onClick={() => toggle(habit)}
                      disabled={pending.has(habit.id)}
                      className={cn(
                        "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all focus-ring",
                        habit.completedToday
                          ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                          : "border-ink-700 bg-ink-900/50 text-ink-200 hover:border-vesper-500/40 hover:bg-ink-800/60 hover:text-white",
                        pending.has(habit.id) && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-md border-2 transition-all",
                          habit.completedToday
                            ? "border-emerald-500 bg-emerald-500 text-ink-950"
                            : "border-ink-600",
                        )}
                      >
                        {habit.completedToday && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                      {habit.completedToday ? "Done today" : "Mark done"}
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------ editor ------------------------------ */}
      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? "Edit habit" : "New habit"}
        description={
          editing
            ? "Adjust the shape of this habit."
            : "Make the first version smaller than feels worthwhile. That's the point."
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create habit"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="h-name">Name</Label>
            <Input
              id="h-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Morning walk"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="h-desc" hint="optional">
              Why it matters
            </Label>
            <Textarea
              id="h-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="20 minutes outside before opening the laptop."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="h-cadence">How often</Label>
              <Select
                id="h-cadence"
                value={draft.cadence}
                onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value as HabitCadence }))}
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays only</option>
                <option value="weekly">A few times a week</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="h-reminder" hint="optional">
                Reminder
              </Label>
              <Input
                id="h-reminder"
                type="time"
                value={draft.reminderTime}
                onChange={(e) => setDraft((d) => ({ ...d, reminderTime: e.target.value }))}
              />
            </div>
          </div>

          {draft.cadence === "weekly" && (
            <div>
              <Label>
                Target <span className="text-white">{draft.targetPerWeek}× per week</span>
              </Label>
              <input
                type="range"
                min={1}
                max={6}
                value={draft.targetPerWeek}
                onChange={(e) => setDraft((d) => ({ ...d, targetPerWeek: Number(e.target.value) }))}
                style={{ ["--pct" as string]: `${((draft.targetPerWeek - 1) / 5) * 100}%` }}
                className="w-full"
              />
            </div>
          )}

          <div>
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, icon: key }))}
                  aria-label={key}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg border transition-all focus-ring",
                    draft.icon === key
                      ? "border-vesper-500 bg-vesper-500/15 text-vesper-200"
                      : "border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(COLORS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, color: key }))}
                  aria-label={key}
                  className={cn(
                    "h-9 w-9 rounded-lg border-2 transition-all focus-ring",
                    COLORS[key],
                    draft.color === key ? "ring-2 ring-white/60 ring-offset-2 ring-offset-ink-950" : "",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this habit?"
        description={`"${deleting?.name}" and its ${deleting?.longestStreak ? `${deleting.longestStreak}-day best streak and ` : ""}completion history will be removed permanently. Archiving keeps the history instead.`}
      />
    </div>
  );
}
