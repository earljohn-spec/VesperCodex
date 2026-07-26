"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmotionTag } from "@/lib/types";
import { POSITIVE_EMOTIONS } from "@/lib/types";

/* ------------------------------- Stat card ------------------------------- */

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "violet",
  invertDelta,
  footer,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "violet" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  invertDelta?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    violet: "text-vesper-300 bg-vesper-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
    rose: "text-rose-300 bg-rose-500/10",
    sky: "text-sky-300 bg-sky-500/10",
    indigo: "text-indigo-300 bg-indigo-500/10",
  };

  const good = delta === undefined ? null : invertDelta ? delta < 0 : delta > 0;
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-400">{label}</span>
        {Icon && (
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tones[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-white">{value}</span>
        {unit && <span className="text-xs text-ink-400">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
            delta === 0 ? "text-ink-500" : good ? "text-emerald-400" : "text-rose-400",
          )}
        >
          <DeltaIcon className="h-3 w-3" />
          {delta > 0 ? "+" : ""}
          {delta}
          {deltaLabel && <span className="font-normal text-ink-500"> {deltaLabel}</span>}
        </div>
      )}
      {footer && <div className="mt-2.5 text-[11px] leading-relaxed text-ink-500">{footer}</div>}
    </div>
  );
}

/* ------------------------------ Emotion chip ----------------------------- */

export function EmotionChip({
  emotion,
  count,
  selected,
  onClick,
  size = "md",
}: {
  emotion: string;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const positive = POSITIVE_EMOTIONS.has(emotion as EmotionTag);
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium capitalize transition-all",
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-xs",
        onClick && "hover:scale-[1.03] active:scale-100 focus-ring cursor-pointer",
        selected
          ? positive
            ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
            : "border-amber-400/60 bg-amber-500/20 text-amber-200"
          : positive
            ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300/90"
            : "border-amber-500/25 bg-amber-500/[0.08] text-amber-300/90",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          positive ? "bg-emerald-400" : "bg-amber-400",
        )}
      />
      {emotion}
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </Comp>
  );
}

/* -------------------------------- Mood dot ------------------------------- */

export function moodTone(score: number) {
  if (score >= 8) return { label: "Great", color: "#34d399", tone: "emerald" as const };
  if (score >= 6.5) return { label: "Good", color: "#a3e635", tone: "emerald" as const };
  if (score >= 5) return { label: "Okay", color: "#fbbf24", tone: "amber" as const };
  if (score >= 3.5) return { label: "Low", color: "#fb923c", tone: "amber" as const };
  return { label: "Hard", color: "#f87171", tone: "rose" as const };
}

export function MoodDot({ score, size = 34 }: { score: number; size?: number }) {
  const { color, label } = moodTone(score);
  return (
    <span
      title={`${label} · ${score}/10`}
      className="grid shrink-0 place-items-center rounded-xl text-xs font-semibold tabular-nums"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`,
      }}
    >
      {score}
    </span>
  );
}

/* ------------------------------ Stress meter ----------------------------- */

export function stressTone(index: number) {
  if (index >= 78) return { label: "High", tone: "rose" as const, color: "#f87171" };
  if (index >= 65) return { label: "Elevated", tone: "amber" as const, color: "#fbbf24" };
  if (index >= 45) return { label: "Moderate", tone: "sky" as const, color: "#38bdf8" };
  return { label: "Calm", tone: "emerald" as const, color: "#34d399" };
}

/* --------------------------- Page header block --------------------------- */

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------ Markdown-ish ----------------------------- */

/**
 * Tiny renderer for the subset of markdown the companion emits: **bold**,
 * *italic*, `code`, bullet lists and paragraphs. Avoids pulling in a full
 * markdown pipeline for a handful of inline styles.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);

  const inline = (s: string, keyPrefix: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) nodes.push(s.slice(last, m.index));
      const token = m[0];
      const key = `${keyPrefix}-${i++}`;
      if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
      else if (token.startsWith("`"))
        nodes.push(
          <code key={key} className="rounded bg-ink-800 px-1 py-0.5 text-[0.85em]">
            {token.slice(1, -1)}
          </code>,
        );
      else nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
      last = m.index + token.length;
    }
    if (last < s.length) nodes.push(s.slice(last));
    return nodes;
  };

  return (
    <div className={cn("msg", className)}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className={bi > 0 ? "mt-3" : undefined}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className={bi > 0 ? "mt-3" : undefined}>
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
