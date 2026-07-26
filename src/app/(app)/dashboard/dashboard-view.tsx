"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BookHeart,
  Check,
  Flame,
  HeartPulse,
  MessageCircleHeart,
  Moon,
  Plus,
  Repeat2,
  Sparkles,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar, useToast } from "@/components/ui";
import { LineChart, RadialGauge, Sparkline } from "@/components/charts";
import { EmotionChip, MoodDot, PageHeader, StatCard, stressTone } from "@/components/shared";
import { BreathingPlayer } from "@/components/breathing";
import { OfflineBanner, offlineFetch } from "@/components/offline";
import { cn, formatTime, greeting, relativeTime, todayKey } from "@/lib/utils";
import type {
  Biometric,
  HabitWithStats,
  Intervention,
  JournalEntry,
  User,
} from "@/lib/types";
import type { JournalStats } from "@/lib/repos/journal";
import type { BiometricSummary } from "@/lib/repos/biometrics";
import type { HabitSummary } from "@/lib/repos/habits";
import type { InterventionSummary } from "@/lib/repos/interventions";

interface Props {
  user: User;
  stats: JournalStats;
  bio: BiometricSummary;
  habits: HabitWithStats[];
  habitSummary: HabitSummary;
  activeBreaks: Intervention[];
  breakSummary: InterventionSummary;
  trend: { date: string; mood: number | null; energy: number | null; count: number }[];
  emotions: { emotion: string; count: number; positive: boolean }[];
  recentEntries: JournalEntry[];
  samples: Biometric[];
  prompt: string;
}

export function DashboardView({
  user,
  stats,
  bio,
  habits,
  habitSummary,
  activeBreaks,
  breakSummary,
  trend,
  emotions,
  recentEntries,
  samples,
  prompt,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const firstName = user.name.split(" ")[0];

  const [breaks, setBreaks] = React.useState(activeBreaks);
  const [localHabits, setLocalHabits] = React.useState(habits);
  const [player, setPlayer] = React.useState<Intervention | null>(null);
  const [pendingHabits, setPendingHabits] = React.useState<Set<string>>(new Set());

  React.useEffect(() => setBreaks(activeBreaks), [activeBreaks]);
  React.useEffect(() => setLocalHabits(habits), [habits]);

  const stress = stressTone(bio.stressNow);
  const topBreak = breaks[0];

  /* -------------------------- optimistic actions -------------------------- */

  async function resolveBreak(id: string, status: "completed" | "dismissed") {
    const prev = breaks;
    setBreaks((b) => b.filter((x) => x.id !== id)); // optimistic
    const res = await offlineFetch(`/api/breaks/${id}`, {
      method: "PATCH",
      body: { status },
      label: `${status} micro-break`,
    });
    if (!res.ok) {
      setBreaks(prev);
      toast("Couldn't update that break", "error");
      return;
    }
    toast(
      res.queued
        ? "Saved offline — will sync when you reconnect"
        : status === "completed"
          ? "Nice. That counts."
          : "Dismissed",
      res.queued ? "info" : "success",
    );
    if (!res.queued) router.refresh();
  }

  async function toggleHabit(habit: HabitWithStats) {
    const wasComplete = habit.completedToday;
    setPendingHabits((s) => new Set(s).add(habit.id));
    setLocalHabits((hs) =>
      hs.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              completedToday: !wasComplete,
              currentStreak: wasComplete ? Math.max(0, h.currentStreak - 1) : h.currentStreak + 1,
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

    setPendingHabits((s) => {
      const n = new Set(s);
      n.delete(habit.id);
      return n;
    });

    if (!res.ok) {
      setLocalHabits(habits);
      toast("Couldn't save that", "error");
      return;
    }
    if (res.queued) toast("Saved offline — syncs later", "info");
    else router.refresh();
  }

  async function completeBreakFromPlayer(id: string) {
    await resolveBreak(id, "completed");
  }

  async function startFreshBreak() {
    const res = await offlineFetch("/api/breaks", {
      method: "POST",
      body: { auto: true },
      label: "new micro-break",
    });
    if (res.ok && !res.queued) {
      const created = (res.data as { intervention: Intervention }).intervention;
      setPlayer(created);
      setBreaks((b) => [created, ...b]);
      router.refresh();
    } else if (res.queued) {
      toast("You're offline — try a two-minute box breath anyway", "info");
    }
  }

  const dueHabits = localHabits.filter((h) => {
    if (h.cadence === "daily") return true;
    if (h.cadence === "weekdays") {
      const d = new Date().getDay();
      return d >= 1 && d <= 5;
    }
    return h.completionsThisWeek < h.targetPerWeek || h.completedToday;
  });
  const doneCount = dueHabits.filter((h) => h.completedToday).length;

  const stressSeries = samples.map((s) => s.stressIndex);
  const moodSeries = trend.map((t) => ({ date: t.date, value: t.mood }));

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={prompt}
        action={
          <div className="flex gap-2">
            <Link href="/journal?new=1">
              <Button variant="secondary" size="md">
                <Plus className="h-4 w-4" />
                Log mood
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="md">
                <MessageCircleHeart className="h-4 w-4" />
                Talk it through
              </Button>
            </Link>
          </div>
        }
      />

      {/* ----------------------- live intervention ----------------------- */}
      {topBreak && (
        <Card className="mb-5 overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/[0.09] to-transparent animate-slide-up">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
              <span className="absolute inset-0 rounded-2xl bg-amber-500/20 animate-pulse-ring" />
              <Wind className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{topBreak.title}</h2>
                <Badge tone="amber">
                  <Zap className="h-3 w-3" />
                  Stress detected
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-300">{topBreak.detail}</p>
              <p className="mt-1.5 text-[11px] text-amber-300/80">
                {topBreak.triggerNote} · {relativeTime(topBreak.triggeredAt)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="md" onClick={() => setPlayer(topBreak)}>
                <Wind className="h-4 w-4" />
                Start · {Math.round(topBreak.durationSec / 60)} min
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss"
                onClick={() => resolveBreak(topBreak.id, "dismissed")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ----------------------------- stats ----------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mood · 7-day avg"
          value={stats.avgMood7 ? stats.avgMood7.toFixed(1) : "—"}
          unit="/ 10"
          delta={stats.moodDelta || undefined}
          deltaLabel="vs last week"
          icon={BookHeart}
          tone="violet"
          footer={
            stats.streak > 0
              ? `${stats.streak}-day journalling streak`
              : "Log today to start a streak"
          }
        />
        <StatCard
          label="Stress right now"
          value={bio.stressNow}
          unit="/ 100"
          icon={HeartPulse}
          tone={stress.tone}
          footer={
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stress.color }} />
              {stress.label} ·{" "}
              {bio.lastSyncAt ? `synced ${relativeTime(bio.lastSyncAt)}` : "no data"}
            </span>
          }
        />
        <StatCard
          label="HRV vs baseline"
          value={bio.currentHrv ? `${bio.currentHrv.toFixed(0)}` : "—"}
          unit="ms"
          delta={bio.hrvDelta || undefined}
          deltaLabel={`vs ${bio.baselineHrv.toFixed(0)}ms baseline`}
          icon={Activity}
          tone={bio.hrvDelta >= 0 ? "emerald" : "amber"}
          footer={
            bio.sleepLastNight
              ? `${bio.sleepLastNight.toFixed(1)}h sleep · readiness ${bio.readiness}/100`
              : `Readiness ${bio.readiness}/100`
          }
        />
        <StatCard
          label="Habits today"
          value={`${doneCount}/${dueHabits.length}`}
          icon={Repeat2}
          tone="emerald"
          footer={
            habitSummary.bestStreak > 0 ? (
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-amber-400" />
                Best streak {habitSummary.bestStreak} days
              </span>
            ) : (
              "Tick one to get going"
            )
          }
        />
      </div>

      {/* ---------------------------- main grid --------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* mood trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Mood & energy"
            subtitle="Last 30 days, averaged per day"
            icon={BookHeart}
            action={
              <Link
                href="/journal"
                className="text-xs font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded"
              >
                All entries →
              </Link>
            }
          />
          <div className="px-3 pb-4">
            <LineChart
              series={moodSeries}
              height={216}
              min={1}
              max={10}
              bands={[
                { from: 1, to: 4, color: "rgba(248,113,113,0.05)" },
                { from: 7, to: 10, color: "rgba(52,211,153,0.05)" },
              ]}
              formatValue={(v) => `Mood ${v.toFixed(1)}/10`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-ink-800 px-5 py-3 text-[11px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-vesper-400" />
              Mood
            </span>
            {stats.bestDay && (
              <span>
                Best day{" "}
                <span className="text-emerald-300">
                  {new Date(`${stats.bestDay.date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>{" "}
                ({stats.bestDay.mood})
              </span>
            )}
            {stats.hardestDay && (
              <span>
                Hardest{" "}
                <span className="text-rose-300">
                  {new Date(`${stats.hardestDay.date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>{" "}
                ({stats.hardestDay.mood})
              </span>
            )}
            <span className="ml-auto">{stats.last30} entries · {stats.voiceShare}% by voice</span>
          </div>
        </Card>

        {/* body */}
        <Card>
          <CardHeader
            title="Body signals"
            subtitle="From your connected wearables"
            icon={HeartPulse}
            action={
              <Link
                href="/biometrics"
                className="text-xs font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded"
              >
                Details →
              </Link>
            }
          />
          <div className="flex flex-col items-center px-5 pb-5">
            <RadialGauge
              value={bio.readiness}
              label="Readiness"
              sublabel={bio.readiness >= 66 ? "Good capacity" : bio.readiness >= 40 ? "Take it steady" : "Protect today"}
              tone={bio.readiness >= 66 ? "emerald" : bio.readiness >= 40 ? "amber" : "rose"}
            />
            <div className="mt-4 w-full">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-ink-400">Stress · last 14h</span>
                <span className="font-medium" style={{ color: stress.color }}>
                  peak {bio.peakStress24}
                </span>
              </div>
              <Sparkline
                values={stressSeries.length > 1 ? stressSeries : [0, 0]}
                color={stress.color}
                height={40}
              />
            </div>
            <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-ink-800 pt-4 text-center">
              {[
                ["Resting HR", bio.restingHr ? `${Math.round(bio.restingHr)}` : "—", "bpm"],
                ["Sleep", bio.sleepLastNight ? bio.sleepLastNight.toFixed(1) : "—", "hrs"],
                ["Spikes", `${bio.spikeCount24}`, "today"],
              ].map(([label, value, unit]) => (
                <div key={label}>
                  <p className="text-sm font-semibold tabular-nums text-white">{value}</p>
                  <p className="text-[10px] text-ink-500">
                    {label} <span className="opacity-60">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* habits */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's habits"
            subtitle={
              doneCount === dueHabits.length && dueHabits.length > 0
                ? "All done — that's the whole list"
                : `${dueHabits.length - doneCount} left, no pressure`
            }
            icon={Repeat2}
            action={
              <Link
                href="/habits"
                className="text-xs font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded"
              >
                Manage →
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {dueHabits.length === 0 ? (
              <EmptyState
                icon={Repeat2}
                title="No habits yet"
                description="Start with one, and make it small enough that a bad day can't break it."
                action={
                  <Link href="/habits?new=1">
                    <Button size="sm">
                      <Plus className="h-3.5 w-3.5" />
                      Add a habit
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <ProgressBar
                  value={dueHabits.length ? (doneCount / dueHabits.length) * 100 : 0}
                  tone="emerald"
                  className="mb-4"
                />
                <ul className="space-y-2">
                  {dueHabits.slice(0, 5).map((habit) => (
                    <li key={habit.id}>
                      <button
                        onClick={() => toggleHabit(habit)}
                        disabled={pendingHabits.has(habit.id)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all focus-ring",
                          habit.completedToday
                            ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                            : "border-ink-800 bg-ink-900/40 hover:border-ink-700 hover:bg-ink-800/50",
                          pendingHabits.has(habit.id) && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-all",
                            habit.completedToday
                              ? "border-emerald-500 bg-emerald-500 text-ink-950"
                              : "border-ink-600 group-hover:border-vesper-400",
                          )}
                        >
                          {habit.completedToday && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-medium transition-colors",
                              habit.completedToday ? "text-emerald-100/70 line-through" : "text-white",
                            )}
                          >
                            {habit.name}
                          </span>
                          {habit.reminderTime && (
                            <span className="text-[11px] text-ink-500">{habit.reminderTime}</span>
                          )}
                        </span>
                        {habit.currentStreak > 0 && (
                          <Badge tone={habit.currentStreak >= 7 ? "amber" : "neutral"}>
                            <Flame className="h-3 w-3" />
                            {habit.currentStreak}
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>

        {/* emotions */}
        <Card>
          <CardHeader title="What you've been feeling" subtitle="Tagged across the last 30 days" icon={Sparkles} />
          <div className="px-5 pb-5">
            {emotions.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No tags yet"
                description="Emotion tags appear here once you've logged a few entries."
                className="py-8"
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {emotions.map((e) => (
                    <EmotionChip key={e.emotion} emotion={e.emotion} count={e.count} size="sm" />
                  ))}
                </div>
                <div className="mt-4 border-t border-ink-800 pt-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-400">Positive vs difficult</span>
                    <span className="font-medium text-ink-200">
                      {Math.round(
                        (emotions.filter((e) => e.positive).reduce((a, e) => a + e.count, 0) /
                          Math.max(1, emotions.reduce((a, e) => a + e.count, 0))) *
                          100,
                      )}
                      % positive
                    </span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="bg-emerald-500/70"
                      style={{
                        width: `${(emotions.filter((e) => e.positive).reduce((a, e) => a + e.count, 0) / Math.max(1, emotions.reduce((a, e) => a + e.count, 0))) * 100}%`,
                      }}
                    />
                    <div className="flex-1 bg-amber-500/60" />
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* recent entries */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent entries"
            subtitle="Your last few check-ins"
            icon={BookHeart}
            action={
              <Link href="/journal?new=1">
                <Button variant="ghost" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {recentEntries.length === 0 ? (
              <EmptyState
                icon={BookHeart}
                title="Nothing logged yet"
                description="Even one line helps Vesper learn your patterns. Voice notes count."
                action={
                  <Link href="/journal?new=1">
                    <Button size="sm">
                      <Plus className="h-3.5 w-3.5" />
                      Write your first entry
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {recentEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/journal?entry=${entry.id}`}
                      className="flex gap-3.5 rounded-xl border border-ink-800 bg-ink-900/40 p-3.5 transition-all hover:border-ink-700 hover:bg-ink-800/50 focus-ring"
                    >
                      <MoodDot score={entry.moodScore} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {entry.title || "Untitled entry"}
                          </p>
                          {entry.source === "voice" && (
                            <Badge tone="sky" className="shrink-0">
                              voice
                            </Badge>
                          )}
                          {!entry.synced && (
                            <Badge tone="amber" className="shrink-0">
                              pending sync
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-400">
                          {entry.body || "No details written."}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-ink-500">
                            {relativeTime(entry.entryDate)} · {formatTime(entry.entryDate)}
                          </span>
                          {entry.emotions.slice(0, 3).map((em) => (
                            <EmotionChip key={em} emotion={em} size="sm" />
                          ))}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* quick reset */}
        <Card className="flex flex-col">
          <CardHeader title="Need a reset?" subtitle="Two minutes, no setup" icon={Wind} />
          <div className="flex flex-1 flex-col px-5 pb-5">
            <div className="flex-1 space-y-2">
              {breaks.slice(0, 2).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setPlayer(b)}
                  className="w-full rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-left transition-all hover:border-vesper-500/40 hover:bg-ink-800/50 focus-ring"
                >
                  <p className="text-sm font-medium text-white">{b.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-400">
                    {b.detail}
                  </p>
                </button>
              ))}
              {breaks.length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-700/70 p-4 text-center">
                  <Moon className="mx-auto h-5 w-5 text-ink-500" />
                  <p className="mt-2 text-xs font-medium text-ink-300">Nothing flagged</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    Your body signals look settled. You can still take one whenever.
                  </p>
                </div>
              )}
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={startFreshBreak}>
              <Wind className="h-4 w-4" />
              Start a reset now
            </Button>
            {breakSummary.completed7 > 0 && (
              <p className="mt-3 text-center text-[11px] text-ink-500">
                {breakSummary.completed7} completed this week ·{" "}
                {breakSummary.minutesReclaimed7} min reclaimed
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* companion nudge */}
      <Card className="mt-5 overflow-hidden border-vesper-500/25 bg-gradient-to-r from-vesper-600/[0.11] via-vesper-600/[0.04] to-transparent">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-vesper-500/15 text-vesper-300">
            <MessageCircleHeart className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">Vesper has context on all of this</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              Your mood trend, HRV dips, habit streaks and what has worked for you before — it all
              feeds the conversation. Ask it something specific.
            </p>
          </div>
          <Link href="/chat" className="shrink-0">
            <Button>
              Open companion
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>

      {player && (
        <BreathingPlayer
          open={!!player}
          onClose={() => setPlayer(null)}
          title={player.title}
          detail={player.detail}
          kind={player.kind}
          durationSec={player.durationSec}
          onComplete={() => completeBreakFromPlayer(player.id)}
        />
      )}
    </div>
  );
}
