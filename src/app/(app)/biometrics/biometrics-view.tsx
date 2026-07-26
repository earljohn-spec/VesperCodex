"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BatteryMedium,
  Bluetooth,
  Footprints,
  HeartPulse,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Watch,
  Wind,
  Zap,
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
  Select,
  useToast,
} from "@/components/ui";
import { LineChart, RadialGauge } from "@/components/charts";
import { PageHeader, StatCard, stressTone } from "@/components/shared";
import { BreathingPlayer } from "@/components/breathing";
import { OfflineBanner, useOffline } from "@/components/offline";
import { cn, formatTime, relativeTime } from "@/lib/utils";
import { useSyncedState } from "@/lib/use-synced-state";
import type { Biometric, Device, DeviceProvider, Intervention } from "@/lib/types";
import type { BiometricSummary } from "@/lib/repos/biometrics";

const PROVIDERS: { value: DeviceProvider; label: string }[] = [
  { value: "apple_watch", label: "Apple Watch" },
  { value: "fitbit", label: "Fitbit" },
  { value: "oura", label: "Oura Ring" },
  { value: "garmin", label: "Garmin" },
  { value: "manual", label: "Manual entry" },
];

const PROVIDER_LABEL: Record<DeviceProvider, string> = {
  apple_watch: "Apple Watch",
  fitbit: "Fitbit",
  oura: "Oura",
  garmin: "Garmin",
  manual: "Manual",
};

export function BiometricsView({
  devices: initialDevices,
  summary: initialSummary,
  samples: initialSamples,
  recentSpikes,
}: {
  devices: Device[];
  summary: BiometricSummary;
  samples: Biometric[];
  recentSpikes: Intervention[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { offline } = useOffline();

  const [devices, setDevices] = useSyncedState(initialDevices);
  const [summary, setSummary] = useSyncedState(initialSummary);
  const [samples, setSamples] = useSyncedState(initialSamples);
  const [syncing, setSyncing] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Device | null>(null);
  const [player, setPlayer] = React.useState<Intervention | null>(null);
  const [draft, setDraft] = React.useState<{ provider: DeviceProvider; displayName: string }>({
    provider: "apple_watch",
    displayName: "",
  });


  const stress = stressTone(summary.stressNow);

  /* -------------------------------- actions ------------------------------- */

  async function sync(simulateSpike = false) {
    if (offline) return toast("Wearable sync needs a connection", "info");
    setSyncing(true);
    try {
      const res = await fetch("/api/biometrics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateSpike }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary);
      setSamples((s) => [...s, data.sample]);
      if (data.intervention) {
        toast("Stress spike detected — Vesper suggested a reset", "info");
        setPlayer(data.intervention);
      } else if (data.spikeDetected) {
        toast("Stress spike detected", "info");
      } else {
        toast("Synced");
      }
      router.refresh();
    } catch {
      toast("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function addDevice() {
    const name = draft.displayName.trim() || PROVIDER_LABEL[draft.provider];
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: draft.provider, displayName: name }),
    });
    if (!res.ok) return toast("Couldn't connect that device", "error");
    const { device } = await res.json();
    setDevices((d) => [...d, device]);
    setAddOpen(false);
    setDraft({ provider: "apple_watch", displayName: "" });
    toast(`${name} connected`);
    router.refresh();
  }

  async function toggleDevice(device: Device) {
    const next = device.status === "paused" ? "connected" : "paused";
    setDevices((ds) => ds.map((d) => (d.id === device.id ? { ...d, status: next } : d)));
    const res = await fetch(`/api/devices/${device.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setDevices(initialDevices);
      return toast("Couldn't update device", "error");
    }
    toast(next === "paused" ? "Syncing paused" : "Syncing resumed");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const prev = devices;
    setDevices((ds) => ds.filter((d) => d.id !== id));
    setDeleting(null);
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDevices(prev);
      return toast("Couldn't disconnect", "error");
    }
    toast("Device disconnected");
    router.refresh();
  }

  /* -------------------------------- charts -------------------------------- */

  // Samples are intraday: keep the full timestamp so the axis can label by
  // time. Truncating to YYYY-MM-DD would collapse 24h of readings onto one or
  // two labels (and previously collided React keys).
  const hrvSeries = samples.map((s) => ({ date: s.recordedAt, value: s.hrv }));
  const stressSeries = samples.map((s) => ({ date: s.recordedAt, value: s.stressIndex }));

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <OfflineBanner />

      <PageHeader
        title="Biometrics"
        description="Your body flags stress before your head does. Vesper watches HRV and heart rate, then offers a reset — it never nags."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => sync(true)} disabled={syncing || offline}>
              <Zap className="h-4 w-4" />
              Simulate spike
            </Button>
            <Button onClick={() => sync(false)} loading={syncing} disabled={offline}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              Sync now
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stress index"
          value={summary.stressNow}
          unit="/ 100"
          icon={HeartPulse}
          tone={stress.tone}
          footer={
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stress.color }} />
              {stress.label} · {summary.spikeCount24} spike{summary.spikeCount24 === 1 ? "" : "s"} today
            </span>
          }
        />
        <StatCard
          label="HRV"
          value={summary.currentHrv ? summary.currentHrv.toFixed(0) : "—"}
          unit="ms"
          delta={summary.hrvDelta || undefined}
          deltaLabel="vs baseline"
          icon={Activity}
          tone={summary.hrvDelta >= 0 ? "emerald" : "amber"}
          footer={`30-day baseline ${summary.baselineHrv.toFixed(0)}ms`}
        />
        <StatCard
          label="Sleep"
          value={summary.sleepLastNight ? summary.sleepLastNight.toFixed(1) : "—"}
          unit="hrs"
          icon={Moon}
          tone="indigo"
          footer={
            summary.sleepLastNight == null
              ? "No sleep data"
              : summary.sleepLastNight >= 7
                ? "Solid night"
                : "Below your target"
          }
        />
        <StatCard
          label="Steps today"
          value={summary.stepsToday.toLocaleString()}
          icon={Footprints}
          tone="sky"
          footer={
            summary.restingHr ? `Resting HR ${Math.round(summary.restingHr)} bpm` : undefined
          }
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's signals"
            subtitle="HRV and derived stress across the last 24 hours"
            icon={Activity}
          />
          {samples.length < 2 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={Activity}
                title="No samples yet"
                description="Connect a wearable or hit Sync now to pull in a reading."
                action={
                  <Button size="sm" onClick={() => sync(false)} disabled={offline}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync now
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="px-3 pb-1">
                <p className="px-2 pb-1 text-[11px] text-ink-500">HRV (ms) — higher is calmer</p>
                <LineChart
                  series={hrvSeries}
                  height={160}
                  axis="time"
                  min={10}
                  max={Math.max(90, ...samples.map((s) => s.hrv ?? 0)) + 10}
                  color="#6ee7b7"
                  fillFrom="rgba(52,211,153,0.22)"
                  formatValue={(v) => `${v.toFixed(0)} ms`}
                />
              </div>
              <div className="border-t border-ink-800 px-3 pb-4 pt-2">
                <p className="px-2 pb-1 text-[11px] text-ink-500">
                  Stress index — 65+ triggers a suggestion
                </p>
                <LineChart
                  series={stressSeries}
                  height={130}
                  axis="time"
                  min={0}
                  max={100}
                  color="#fbbf24"
                  fillFrom="rgba(251,191,36,0.2)"
                  bands={[{ from: 65, to: 100, color: "rgba(248,113,113,0.06)" }]}
                  formatValue={(v) => `${v.toFixed(0)}/100`}
                />
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-4 border-t border-ink-800 px-5 py-3 text-[11px] text-ink-400">
            <span>Peak stress {summary.peakStress24}/100</span>
            <span>24h average {summary.stressAvg24}/100</span>
            <span className="ml-auto">
              {summary.lastSyncAt ? `Last sample ${relativeTime(summary.lastSyncAt)}` : "No data"}
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Readiness" subtitle="HRV, sleep and stress combined" icon={HeartPulse} />
          <div className="flex flex-col items-center px-5 pb-5">
            <RadialGauge
              value={summary.readiness}
              label="Readiness"
              sublabel={
                summary.readiness >= 66
                  ? "Good capacity today"
                  : summary.readiness >= 40
                    ? "Take it steady"
                    : "Protect your energy"
              }
              tone={summary.readiness >= 66 ? "emerald" : summary.readiness >= 40 ? "amber" : "rose"}
            />
            <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
              {summary.readiness >= 66
                ? "Your body has capacity. A good day to spend some energy on the hard thing."
                : summary.readiness >= 40
                  ? "Middling reserves. Shrink the task rather than the timeline."
                  : "Low reserves. Today is for maintenance, not ambition."}
            </p>
            <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t border-ink-800 pt-4 text-center">
              <div>
                <p className="text-sm font-semibold tabular-nums text-white">
                  {summary.restingHr ? Math.round(summary.restingHr) : "—"}
                </p>
                <p className="text-[10px] text-ink-500">Resting HR</p>
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums text-white">
                  {summary.currentHr ? Math.round(summary.currentHr) : "—"}
                </p>
                <p className="text-[10px] text-ink-500">Current HR</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------ devices ----------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Connected devices"
            subtitle="Vesper reads HRV, heart rate and sleep — nothing else"
            icon={Watch}
            action={
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Connect
              </Button>
            }
          />
          <div className="px-5 pb-5">
            {devices.length === 0 ? (
              <EmptyState
                icon={Bluetooth}
                title="No devices connected"
                description="Connect a wearable so Vesper can spot stress spikes before you feel them. You can also log readings manually."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Connect a device
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="group flex items-center gap-3.5 rounded-xl border border-ink-800 bg-ink-900/40 p-3.5"
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                        device.status === "connected"
                          ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-300"
                          : device.status === "paused"
                            ? "border-ink-700 bg-ink-800 text-ink-400"
                            : "border-rose-500/25 bg-rose-500/12 text-rose-300",
                      )}
                    >
                      <Watch className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {device.displayName}
                        </p>
                        <Badge
                          tone={
                            device.status === "connected"
                              ? "emerald"
                              : device.status === "paused"
                                ? "neutral"
                                : "rose"
                          }
                        >
                          {device.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                        <span>{PROVIDER_LABEL[device.provider]}</span>
                        {device.battery != null && (
                          <span className="flex items-center gap-1">
                            <BatteryMedium className="h-3 w-3" />
                            {device.battery}%
                          </span>
                        )}
                        {device.lastSyncAt && <span>synced {relativeTime(device.lastSyncAt)}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => toggleDevice(device)}
                        aria-label={device.status === "paused" ? "Resume syncing" : "Pause syncing"}
                        className="rounded-lg p-2 text-ink-500 hover:bg-ink-800 hover:text-white focus-ring"
                      >
                        {device.status === "paused" ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleting(device)}
                        aria-label="Disconnect device"
                        className="rounded-lg p-2 text-ink-500 hover:bg-ink-800 hover:text-rose-300 focus-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent detections" subtitle="What triggered a nudge" icon={Zap} />
          <div className="px-5 pb-5">
            {recentSpikes.length === 0 ? (
              <EmptyState
                icon={Wind}
                title="Nothing flagged"
                description="When your HRV drops sharply, the trigger will be logged here."
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {recentSpikes.slice(0, 5).map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-white">{s.title}</p>
                      <Badge
                        tone={
                          s.status === "completed"
                            ? "emerald"
                            : s.status === "suggested"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                      {s.triggerNote}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-600">
                      {relativeTime(s.triggeredAt)} · {formatTime(s.triggeredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-600">
        Readings in this demo are simulated locally. In production these arrive from Apple HealthKit
        or the Fitbit Web API. Vesper is not a medical device and does not diagnose.
      </p>

      {/* ------------------------------- modals ----------------------------- */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Connect a device"
        description="Vesper only reads heart-rate variability, heart rate, sleep and steps."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addDevice}>Connect</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="d-provider">Device</Label>
            <Select
              id="d-provider"
              value={draft.provider}
              onChange={(e) =>
                setDraft((d) => ({ ...d, provider: e.target.value as DeviceProvider }))
              }
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="d-name" hint="optional">
              Name it
            </Label>
            <Input
              id="d-name"
              value={draft.displayName}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              placeholder={PROVIDER_LABEL[draft.provider]}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Disconnect this device?"
        description={`${deleting?.displayName} will stop syncing. Readings already collected stay in your history.`}
        confirmLabel="Disconnect"
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
