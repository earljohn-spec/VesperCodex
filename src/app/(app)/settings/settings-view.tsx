"use client";

import * as React from "react";
import {
  Brain,
  CloudOff,
  Database,
  HeartPulse,
  LifeBuoy,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Watch,
  WifiOff,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, useToast } from "@/components/ui";
import { PageHeader } from "@/components/shared";
import { useOffline } from "@/components/offline";
import { logoutAction } from "@/lib/actions/auth";
import { cn, formatDate, initials } from "@/lib/utils";
import { RelativeTime } from "@/components/local-time";
import type { User } from "@/lib/types";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring",
        checked ? "bg-vesper-600" : "bg-ink-700",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsView({
  user,
  counts,
  syncEvents,
}: {
  user: User;
  counts: { entries: number; memories: number; devices: number; pending: number };
  syncEvents: { id: string; resource: string; action: string; status: string; createdAt: string }[];
}) {
  const toast = useToast();
  const { offline, simulated, queue, syncing, flush, setSimulated } = useOffline();

  return (
    <div className="mx-auto max-w-4xl p-5 lg:p-8">
      <PageHeader title="Settings" description="Your account, your data, and how Vesper behaves." />

      {/* -------------------------------- account ------------------------------- */}
      <Card className="mb-5">
        <CardHeader title="Account" subtitle="Who you are to Vesper" icon={ShieldCheck} />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-center">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold text-white ring-2 ring-ink-800"
            style={{
              background: `linear-gradient(140deg, hsl(${user.avatarHue} 70% 58%), hsl(${(user.avatarHue + 45) % 360} 72% 44%))`,
            }}
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-white">{user.name}</p>
            <p className="text-sm text-ink-400">{user.email}</p>
            <p className="mt-1 text-[11px] text-ink-600">
              With Vesper since {formatDate(user.createdAt, { month: "long", year: "numeric" })}
              {user.timezone && ` · ${user.timezone}`}
            </p>
          </div>
          <form action={logoutAction} className="shrink-0">
            <Button type="submit" variant="outline">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
        {user.focusAreas.length > 0 && (
          <div className="border-t border-ink-800 px-5 py-4">
            <p className="mb-2 text-xs font-medium text-ink-300">What you&apos;re working on</p>
            <div className="flex flex-wrap gap-1.5">
              {user.focusAreas.map((f) => (
                <Badge key={f} tone="violet">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------- offline -------------------------------- */}
      <Card className="mb-5">
        <CardHeader
          title="Offline mode"
          subtitle="Vesper keeps working without a connection"
          icon={CloudOff}
        />
        <div className="px-5 pb-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-800 bg-ink-900/40 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Simulate being offline</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">
                Turn this on to see how Vesper behaves during a digital detox or on a bad
                connection. Journalling and habit ticks queue locally and replay when you switch it
                back off.
              </p>
            </div>
            <Toggle
              checked={simulated}
              onChange={(v) => {
                setSimulated(v);
                toast(v ? "Offline mode on" : "Back online — syncing", v ? "info" : "success");
              }}
              label="Simulate offline mode"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl border",
                  offline
                    ? "border-amber-500/25 bg-amber-500/12 text-amber-300"
                    : queue.length
                      ? "border-sky-500/25 bg-sky-500/12 text-sky-300"
                      : "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
                )}
              >
                {offline ? <WifiOff className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-medium text-white">
                  {queue.length
                    ? `${queue.length} change${queue.length === 1 ? "" : "s"} waiting`
                    : "Nothing queued"}
                </p>
                <p className="text-[11px] text-ink-500">
                  {counts.pending > 0
                    ? `${counts.pending} entry saved offline earlier`
                    : "Local outbox is empty"}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={offline || !queue.length}
              loading={syncing}
              onClick={async () => {
                const r = await flush();
                toast(r.ok ? `Synced ${r.ok} change${r.ok === 1 ? "" : "s"}` : "Nothing to sync");
              }}
            >
              Sync now
            </Button>
          </div>

          {queue.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {queue.slice(0, 5).map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/30 px-3 py-2 text-[11px]"
                >
                  <span className="text-ink-300">{q.label}</span>
                  <span className="text-ink-600"><RelativeTime value={q.createdAt} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* --------------------------------- data --------------------------------- */}
      <Card className="mb-5">
        <CardHeader title="Your data" subtitle="Stored locally in your own database" icon={Database} />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
          {[
            { label: "Journal entries", value: counts.entries, icon: Database },
            { label: "Companion memories", value: counts.memories, icon: Brain },
            { label: "Connected devices", value: counts.devices, icon: Watch },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
              <s.icon className="h-4 w-4 text-ink-500" />
              <p className="mt-2 text-xl font-semibold tabular-nums text-white">{s.value}</p>
              <p className="text-[11px] text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>

        {syncEvents.length > 0 && (
          <div className="border-t border-ink-800 px-5 py-4">
            <p className="mb-2.5 text-xs font-medium text-ink-300">Recent sync activity</p>
            <ul className="space-y-1.5">
              {syncEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-900/30 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[11px] text-ink-300">
                    {e.resource.replace(/_/g, " ")} · {e.action.replace(/_/g, " ")}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge
                      tone={
                        e.status === "synced" ? "emerald" : e.status === "pending" ? "amber" : "rose"
                      }
                    >
                      {e.status}
                    </Badge>
                    <span className="text-[10px] text-ink-600"><RelativeTime value={e.createdAt} /></span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* -------------------------------- safety -------------------------------- */}
      <Card className="mb-5 border-rose-500/20">
        <CardHeader
          title="If things get heavy"
          subtitle="Vesper is support, not a substitute for care"
          icon={LifeBuoy}
        />
        <div className="px-5 pb-5">
          <p className="text-xs leading-relaxed text-ink-300">
            Vesper is a wellbeing tool. It does not diagnose, treat, or provide crisis care. If
            you&apos;re struggling, please reach out to a real person — a GP, a therapist, or one of
            these lines:
          </p>
          <ul className="mt-3 space-y-2">
            {[
              ["988", "Suicide & Crisis Lifeline (US) — call or text, 24/7"],
              ["Text HOME to 741741", "Crisis Text Line"],
              ["116 123", "Samaritans (UK & Ireland), free, 24/7"],
              ["1553", "Hopeline (Philippines), 24/7"],
            ].map(([number, desc]) => (
              <li
                key={number}
                className="flex flex-wrap items-baseline gap-2 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2"
              >
                <span className="text-sm font-semibold text-rose-200">{number}</span>
                <span className="text-[11px] text-ink-400">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* --------------------------------- about -------------------------------- */}
      <Card>
        <CardHeader title="About Vesper" subtitle="How the companion works" icon={HeartPulse} />
        <div className="space-y-3 px-5 pb-5 text-xs leading-relaxed text-ink-400">
          <p>
            Vesper grounds every reply in your own data — mood trends, HRV against your baseline,
            habit streaks, and the memories on the{" "}
            <span className="text-ink-200">Memory</span> page. It runs entirely on your instance
            with no external AI calls by default.
          </p>
          <p>
            Set <code className="rounded bg-ink-800 px-1 py-0.5">VESPER_LLM_API_KEY</code> to route
            phrasing through an OpenAI-compatible model instead. The same grounded context is passed
            either way, and it falls back to local generation if the call fails.
          </p>
          <p className="text-ink-500">
            Biometric readings in this build are simulated locally. A production deployment would
            receive them from Apple HealthKit or the Fitbit Web API.
          </p>
        </div>
      </Card>
    </div>
  );
}
