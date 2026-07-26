"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Footprints,
  Hand,
  NotebookPen,
  Play,
  Timer,
  Trash2,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Tabs,
  useToast,
} from "@/components/ui";
import { PageHeader, StatCard, stressTone } from "@/components/shared";
import { BreathingPlayer } from "@/components/breathing";
import { OfflineBanner, offlineFetch } from "@/components/offline";
import { cn, formatDuration, titleCase } from "@/lib/utils";
import { RelativeTime } from "@/components/local-time";
import { useSyncedState } from "@/lib/use-synced-state";
import type { Intervention, InterventionKind } from "@/lib/types";
import type { InterventionSummary } from "@/lib/repos/interventions";

const KIND_ICON: Record<InterventionKind, React.ComponentType<{ className?: string }>> = {
  breathing: Wind,
  micro_break: Clock,
  grounding: Hand,
  movement: Footprints,
  reflection: NotebookPen,
};

const KIND_TONE: Record<InterventionKind, string> = {
  breathing: "bg-sky-500/12 text-sky-300 border-sky-500/25",
  micro_break: "bg-vesper-500/12 text-vesper-300 border-vesper-500/25",
  grounding: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  movement: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  reflection: "bg-indigo-500/12 text-indigo-300 border-indigo-500/25",
};

type Tab = "active" | "completed" | "all";

export function BreaksView({
  interventions,
  summary,
  stressNow,
  library,
}: {
  interventions: Intervention[];
  summary: InterventionSummary;
  stressNow: number;
  library: Record<InterventionKind, { title: string; detail: string; durationSec: number }[]>;
}) {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useSyncedState(interventions);
  const [tab, setTab] = React.useState<Tab>("active");
  const [player, setPlayer] = React.useState<Intervention | null>(null);
  const [deleting, setDeleting] = React.useState<Intervention | null>(null);

  const active = items.filter((i) => i.status === "suggested" || i.status === "snoozed");
  const completed = items.filter((i) => i.status === "completed");
  const shown = tab === "active" ? active : tab === "completed" ? completed : items;
  const stress = stressTone(stressNow);

  /* -------------------------------- actions ------------------------------- */

  async function resolve(id: string, status: "completed" | "dismissed" | "snoozed") {
    const prev = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));

    const res = await offlineFetch(`/api/breaks/${id}`, {
      method: "PATCH",
      body: { status },
      label: `${status} break`,
    });
    if (!res.ok) {
      setItems(prev);
      return toast("Couldn't update that", "error");
    }
    toast(
      res.queued
        ? "Saved offline"
        : status === "completed"
          ? "Logged. That counts."
          : status === "snoozed"
            ? "Snoozed — it'll wait"
            : "Dismissed",
      res.queued ? "info" : "success",
    );
    if (!res.queued) router.refresh();
  }

  /** Start an exercise straight from the library, logging it as we go. */
  async function startFromLibrary(kind: InterventionKind, title: string) {
    const item = library[kind].find((b) => b.title === title);
    if (!item) return;

    // Show the player immediately; persist in the background.
    // crypto.randomUUID keeps the temp id unique without an impure Date.now()
    // read during render.
    const optimistic: Intervention = {
      id: `tmp_${crypto.randomUUID()}`,
      userId: "",
      biometricId: null,
      kind,
      title: item.title,
      detail: item.detail,
      durationSec: item.durationSec,
      triggerNote: "Started manually",
      status: "suggested",
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPlayer(optimistic);

    const res = await offlineFetch("/api/breaks", {
      method: "POST",
      body: {
        kind,
        title: item.title,
        detail: item.detail,
        durationSec: item.durationSec,
        triggerNote: "Started manually",
      },
      label: "start break",
    });
    if (res.ok && !res.queued) {
      const created = (res.data as { intervention: Intervention }).intervention;
      setPlayer(created);
      setItems((list) => [created, ...list]);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    setDeleting(null);
    const res = await offlineFetch(`/api/breaks/${id}`, { method: "DELETE", label: "delete break" });
    if (!res.ok) {
      setItems(prev);
      return toast("Couldn't delete", "error");
    }
    toast("Removed from history");
    if (!res.queued) router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title="Micro-breaks"
        description="Two-minute resets that actually shift your physiology. Vesper suggests them when your body asks; you can start one any time."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Waiting for you"
          value={active.length}
          icon={Zap}
          tone={active.length ? "amber" : "emerald"}
          footer={active.length ? "Suggested by your biometrics" : "Nothing flagged right now"}
        />
        <StatCard
          label="Completed this week"
          value={summary.completed7}
          icon={Check}
          tone="emerald"
          footer={`${summary.completionRate}% of suggestions taken`}
        />
        <StatCard
          label="Time reclaimed"
          value={summary.minutesReclaimed7}
          unit="min"
          icon={Timer}
          tone="violet"
          footer="In the last 7 days"
        />
        <StatCard
          label="Stress right now"
          value={stressNow}
          unit="/ 100"
          icon={Wind}
          tone={stress.tone}
          footer={
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stress.color }} />
              {stress.label}
              {summary.favoriteKind && ` · you favour ${titleCase(summary.favoriteKind)}`}
            </span>
          }
        />
      </div>

      {/* ------------------------------ library ----------------------------- */}
      <Card className="mt-5">
        <CardHeader
          title="Start something now"
          subtitle="No trigger needed — pick whatever fits the moment"
          icon={Play}
        />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(library) as InterventionKind[]).flatMap((kind) =>
            library[kind].slice(0, 1).map((b) => {
              const Icon = KIND_ICON[kind];
              return (
                <button
                  key={b.title}
                  onClick={() => startFromLibrary(kind, b.title)}
                  className="group flex flex-col rounded-xl border border-ink-800 bg-ink-900/40 p-4 text-left transition-all hover:border-vesper-500/40 hover:bg-ink-800/60 focus-ring"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                        KIND_TONE[kind],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{b.title}</span>
                      <span className="text-[11px] text-ink-500">
                        {formatDuration(b.durationSec)} · {titleCase(kind)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-400">
                    {b.detail}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-vesper-300 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-3 w-3" />
                    Begin
                  </span>
                </button>
              );
            }),
          )}
        </div>
      </Card>

      {/* ------------------------------ history ----------------------------- */}
      <div className="mt-6">
        <Tabs
          tabs={[
            { value: "active", label: "Waiting", count: active.length },
            { value: "completed", label: "Completed", count: completed.length },
            { value: "all", label: "All", count: items.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <EmptyState
            icon={Wind}
            title={
              tab === "active"
                ? "Nothing waiting"
                : tab === "completed"
                  ? "No completed breaks yet"
                  : "No breaks logged"
            }
            description={
              tab === "active"
                ? "Your body signals look settled. Vesper will flag a reset if your HRV drops sharply — or start one yourself above."
                : "Once you finish a reset it'll be logged here so you can see what actually helps."
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {shown.map((item) => {
              const Icon = KIND_ICON[item.kind];
              const open = item.status === "suggested" || item.status === "snoozed";
              return (
                <li key={item.id}>
                  <Card
                    className={cn(
                      "group flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                      item.status === "suggested" && "border-amber-500/25 bg-amber-500/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                        KIND_TONE[item.kind],
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-white">{item.title}</h3>
                        <Badge
                          tone={
                            item.status === "completed"
                              ? "emerald"
                              : item.status === "suggested"
                                ? "amber"
                                : item.status === "snoozed"
                                  ? "sky"
                                  : "neutral"
                          }
                        >
                          {item.status}
                        </Badge>
                        <Badge tone="neutral">{formatDuration(item.durationSec)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                        {item.detail}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-600">
                        {item.triggerNote} · <RelativeTime value={item.triggeredAt} />
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {open ? (
                        <>
                          <Button size="sm" onClick={() => setPlayer(item)}>
                            <Play className="h-3.5 w-3.5" />
                            Start
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolve(item.id, "snoozed")}
                            title="Snooze"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolve(item.id, "dismissed")}
                            title="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setPlayer(item)}>
                            <Play className="h-3.5 w-3.5" />
                            Again
                          </Button>
                          <button
                            onClick={() => setDeleting(item)}
                            aria-label="Remove from history"
                            className="rounded-lg p-2 text-ink-600 opacity-0 transition-all hover:bg-ink-800 hover:text-rose-300 group-hover:opacity-100 focus-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {player && (
        <BreathingPlayer
          open={!!player}
          onClose={() => setPlayer(null)}
          title={player.title}
          detail={player.detail}
          kind={player.kind}
          durationSec={player.durationSec}
          onComplete={() => {
            if (!player.id.startsWith("tmp_")) void resolve(player.id, "completed");
            else router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Remove this from history?"
        description="It'll no longer count toward your completion stats. This can't be undone."
        confirmLabel="Remove"
      />
    </div>
  );
}
