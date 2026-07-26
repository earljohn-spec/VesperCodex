"use client";

import * as React from "react";
import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button, Modal } from "./ui";
import { cn } from "@/lib/utils";
import type { InterventionKind } from "@/lib/types";

/** Phase patterns per exercise, in seconds. */
const PATTERNS: Record<string, { phases: [string, number][]; rounds: number }> = {
  "Box breathing · 4-4-4-4": {
    phases: [
      ["Breathe in", 4],
      ["Hold", 4],
      ["Breathe out", 4],
      ["Hold", 4],
    ],
    rounds: 6,
  },
  "4-7-8 downshift": {
    phases: [
      ["Breathe in", 4],
      ["Hold", 7],
      ["Breathe out", 8],
    ],
    rounds: 4,
  },
  "Physiological sigh ×5": {
    phases: [
      ["Inhale", 2],
      ["Top-up inhale", 1],
      ["Long exhale", 6],
    ],
    rounds: 5,
  },
};

const DEFAULT_PATTERN = {
  phases: [
    ["Breathe in", 4],
    ["Hold", 2],
    ["Breathe out", 6],
  ] as [string, number][],
  rounds: 6,
};

export function BreathingPlayer({
  open,
  onClose,
  title,
  detail,
  kind,
  durationSec,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  detail?: string;
  kind: InterventionKind;
  durationSec: number;
  onComplete?: () => void;
}) {
  const isBreathing = kind === "breathing";
  const pattern = PATTERNS[title] ?? DEFAULT_PATTERN;

  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [done, setDone] = React.useState(false);

  const total = isBreathing
    ? pattern.phases.reduce((a, [, s]) => a + s, 0) * pattern.rounds
    : durationSec;

  // Reset the timer whenever the modal is dismissed, so reopening starts fresh.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setRunning(false);
      setElapsed(0);
      setDone(false);
    }
  }

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= total) {
          setRunning(false);
          setDone(true);
          return total;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, total]);

  // work out the current phase
  const cycleLen = pattern.phases.reduce((a, [, s]) => a + s, 0);
  const inCycle = elapsed % cycleLen;
  const round = Math.min(pattern.rounds, Math.floor(elapsed / cycleLen) + 1);
  let acc = 0;
  let phaseLabel = pattern.phases[0][0];
  let phaseLen = pattern.phases[0][1];
  let phaseElapsed = 0;
  for (const [label, len] of pattern.phases) {
    if (inCycle < acc + len) {
      phaseLabel = label;
      phaseLen = len;
      phaseElapsed = inCycle - acc;
      break;
    }
    acc += len;
  }
  const phaseRemaining = Math.ceil(phaseLen - phaseElapsed);

  // circle scale follows the phase
  const scale = !running
    ? 0.86
    : phaseLabel.toLowerCase().includes("in")
      ? 0.7 + (phaseElapsed / phaseLen) * 0.55
      : phaseLabel.toLowerCase().includes("out") || phaseLabel.toLowerCase().includes("exhale")
        ? 1.25 - (phaseElapsed / phaseLen) * 0.55
        : phaseLabel.toLowerCase().includes("hold") && acc === 0
          ? 0.7
          : 1.25;

  const remaining = Math.max(0, total - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Modal open={open} onClose={onClose} title={title} description={detail} size="md">
      <div className="flex flex-col items-center">
        {/* the orb */}
        <div className="relative grid h-56 w-56 place-items-center">
          <div
            className="absolute rounded-full bg-vesper-500/[0.13] blur-xl transition-transform duration-1000 ease-in-out"
            style={{ height: 200, width: 200, transform: `scale(${scale * 1.05})` }}
          />
          <div
            className="absolute rounded-full border border-vesper-400/30 bg-gradient-to-br from-vesper-500/25 to-calm-500/15 transition-transform duration-1000 ease-in-out"
            style={{ height: 168, width: 168, transform: `scale(${scale})` }}
          />
          <div className="relative z-10 flex flex-col items-center">
            {done ? (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check className="h-6 w-6" />
                </span>
                <span className="mt-3 text-sm font-medium text-white">Nicely done</span>
              </>
            ) : (
              <>
                <span className="text-lg font-medium text-white">
                  {running ? phaseLabel : "Ready when you are"}
                </span>
                {running && (
                  <span className="mt-1 text-4xl font-semibold tabular-nums text-vesper-200">
                    {phaseRemaining}
                  </span>
                )}
                {isBreathing && running && (
                  <span className="mt-1 text-[11px] uppercase tracking-wide text-ink-400">
                    Round {round} of {pattern.rounds}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* progress */}
        <div className="mt-2 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-vesper-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(elapsed / total) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-500">
            <span>
              {mm}:{ss} left
            </span>
            <span>{Math.round((elapsed / total) * 100)}%</span>
          </div>
        </div>

        {!isBreathing && detail && (
          <p className="mt-4 rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-center text-xs leading-relaxed text-ink-300">
            {detail}
          </p>
        )}

        <div className="mt-6 flex w-full items-center justify-center gap-2">
          {!done ? (
            <>
              <Button onClick={() => setRunning((r) => !r)} size="lg" className="min-w-36">
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? "Pause" : elapsed > 0 ? "Resume" : "Begin"}
              </Button>
              {elapsed > 0 && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setElapsed(0);
                    setRunning(false);
                  }}
                  aria-label="Restart"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="lg" onClick={onClose}>
                <X className="h-4 w-4" />
                Not now
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                onComplete?.();
                onClose();
              }}
            >
              <Check className="h-4 w-4" />
              Mark complete
            </Button>
          )}
        </div>

        <p className={cn("mt-4 text-center text-[11px] leading-relaxed text-ink-500")}>
          {isBreathing
            ? "Breathe through your nose if you can. If you feel light-headed, return to normal breathing."
            : "Set the phone down. Vesper will keep the timer."}
        </p>
      </div>
    </Modal>
  );
}
