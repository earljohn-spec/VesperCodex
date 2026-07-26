"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMounted } from "./local-time";

/* Lightweight, dependency-free SVG charts tuned for the Vesper palette. */

export interface SeriesPoint {
  /**
   * ISO date (`YYYY-MM-DD`) for daily series, or a full ISO timestamp for
   * intraday series. Values need not be unique — React keys are derived from
   * the index, since two samples can share a calendar day.
   */
  date: string;
  value: number | null;
}

/** How to label the x-axis and tooltips. */
export type AxisMode = "date" | "time";

function labelFor(raw: string, mode: AxisMode, long = false): string {
  // Bare `YYYY-MM-DD` is parsed as UTC by Date, which shifts the day in
  // negative-offset timezones — pin it to local midnight instead.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  if (mode === "time") {
    return long
      ? d.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(
    undefined,
    long
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );
}

/** Round to 3dp — sub-pixel precision is invisible, and fixed decimals keep
 *  the emitted path string byte-identical between server and client. */
function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function buildPath(points: { x: number; y: number }[], smoothing = 0.18) {
  if (points.length < 2) return "";

  // Control points are offset along the vector between a point's neighbours.
  //
  // This deliberately avoids trigonometry. The obvious formulation —
  // cos(atan2(dy,dx)) * hypot(dx,dy) — is algebraically just `dx`, but
  // Math.cos/sin/atan2/hypot are "implementation-approximated" in ECMA-262,
  // so Node's V8 and the browser's V8 may disagree by one ULP. That produced
  // path strings like `2.666666666666666` on the server versus
  // `2.6666666666666665` on the client and tripped React's hydration check.
  // Plain +, -, * are IEEE-754 exact, so they're identical everywhere.
  const controlPoint = (
    cur: { x: number; y: number },
    prev: { x: number; y: number } | undefined,
    next: { x: number; y: number } | undefined,
    reverse?: boolean,
  ) => {
    const p = prev ?? cur;
    const n = next ?? cur;
    const sign = reverse ? -smoothing : smoothing;
    return { x: cur.x + (n.x - p.x) * sign, y: cur.y + (n.y - p.y) * sign };
  };

  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${r3(point.x)},${r3(point.y)}`;
    const cps = controlPoint(a[i - 1], a[i - 2], point);
    const cpe = controlPoint(point, a[i - 1], a[i + 1], true);
    return `${acc} C ${r3(cps.x)},${r3(cps.y)} ${r3(cpe.x)},${r3(cpe.y)} ${r3(point.x)},${r3(point.y)}`;
  }, "");
}

/* ------------------------------- Line chart ------------------------------ */

export function LineChart({
  series,
  height = 200,
  min = 0,
  max = 10,
  color = "#9d7cff",
  fillFrom = "rgba(130,80,251,0.28)",
  formatValue = (v: number) => v.toFixed(1),
  bands,
  axis = "date",
  className,
}: {
  series: SeriesPoint[];
  height?: number;
  min?: number;
  max?: number;
  color?: string;
  fillFrom?: string;
  formatValue?: (v: number) => string;
  bands?: { from: number; to: number; color: string }[];
  /** `date` for one-point-per-day series, `time` for intraday samples. */
  axis?: AxisMode;
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(600);
  // Axis labels use the viewer's locale/timezone, which the server can't know.
  // Hold them back until mount so SSR and hydration agree.
  const mounted = useMounted();

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 8, bottom: 22, left: 28 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const filled = series.filter((p) => p.value !== null) as { date: string; value: number }[];
  const xFor = (i: number) => pad.left + (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);
  const yFor = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

  const pts = series
    .map((p, i) => (p.value === null ? null : { x: xFor(i), y: yFor(p.value), i, value: p.value, date: p.date }))
    .filter(Boolean) as { x: number; y: number; i: number; value: number; date: string }[];

  const path = buildPath(pts);
  const areaPath = pts.length > 1 ? `${path} L ${pts[pts.length - 1].x},${pad.top + innerH} L ${pts[0].x},${pad.top + innerH} Z` : "";
  const gid = React.useId().replace(/:/g, "");

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !pts.length) return null;
    const x = clientX - rect.left;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  };

  const active = hover !== null ? pts.find((p) => p.i === hover) : null;
  const ticks = [min, (min + max) / 2, max];

  if (!filled.length) {
    return (
      <div
        ref={wrapRef}
        className={cn("grid place-items-center text-xs text-ink-500", className)}
        style={{ height }}
      >
        No data in this range yet
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)} style={{ height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          const p = nearest(e.clientX);
          setHover(p ? p.i : null);
        }}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillFrom} />
            <stop offset="100%" stopColor="rgba(130,80,251,0)" />
          </linearGradient>
        </defs>

        {bands?.map((b, i) => (
          <rect
            key={i}
            x={pad.left}
            y={yFor(b.to)}
            width={innerW}
            height={Math.max(0, yFor(b.from) - yFor(b.to))}
            fill={b.color}
          />
        ))}

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={pad.left + innerW}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="rgba(139,133,180,0.14)"
              strokeDasharray="3 4"
            />
            <text x={pad.left - 7} y={yFor(t) + 3.5} textAnchor="end" className="fill-ink-500 text-[9px]">
              {Math.round(t)}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill={`url(#grad-${gid})`} />}
        <path d={path} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />

        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="rgba(157,124,255,0.45)"
              strokeWidth={1}
            />
            <circle cx={active.x} cy={active.y} r={5.5} fill={color} stroke="#110f1e" strokeWidth={2.5} />
          </>
        )}

        {series.map((p, i) =>
          i % Math.max(1, Math.ceil(series.length / 6)) === 0 ? (
            // Keyed by index: intraday series repeat the same calendar date,
            // so `p.date` is not a unique identity.
            <text
              key={`tick-${i}`}
              suppressHydrationWarning
              x={xFor(i)}
              y={height - 5}
              textAnchor="middle"
              className="fill-ink-500 text-[9px]"
            >
              {mounted ? labelFor(p.date, axis) : ""}
            </text>
          ) : null,
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ left: active.x, top: active.y - 10 }}
        >
          <div className="font-semibold text-white">{formatValue(active.value)}</div>
          <div className="text-ink-400">{labelFor(active.date, axis, true)}</div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Sparkline ------------------------------- */

export function Sparkline({
  values,
  color = "#9d7cff",
  height = 36,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return <div className={cn("h-9", className)} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: height - ((v - min) / range) * (height - 6) - 3,
  }));
  const d = buildPath(pts, 0.16);
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <path d={`${d} L ${w},${height} L 0,${height} Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* -------------------------------- Bar chart ------------------------------- */

export function BarChart({
  data,
  height = 180,
  className,
}: {
  data: { label: string; value: number; tone?: string }[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("flex items-end gap-2", className)} style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-2 min-w-0">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-125"
              style={{
                height: `${Math.max(3, (d.value / max) * 100)}%`,
                background: d.tone ?? "linear-gradient(180deg,#9d7cff,#762ef3)",
              }}
            />
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              {d.value}
            </span>
          </div>
          <span className="w-full truncate text-center text-[9.5px] text-ink-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Radial gauge ----------------------------- */

export function RadialGauge({
  value,
  max = 100,
  size = 132,
  stroke = 10,
  label,
  sublabel,
  tone = "violet",
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: "violet" | "emerald" | "amber" | "rose" | "sky";
}) {
  const colors = {
    violet: ["#9d7cff", "#762ef3"],
    emerald: ["#6ee7b7", "#059669"],
    amber: ["#fcd34d", "#d97706"],
    rose: ["#fda4af", "#e11d48"],
    sky: ["#7dd3fc", "#0284c7"],
  }[tone];

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const gid = React.useId().replace(/:/g, "");

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`gauge-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(139,133,180,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#gauge-${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums text-white">{Math.round(value)}</span>
        {label && <span className="text-[10px] uppercase tracking-wide text-ink-400">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] text-ink-500">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------- Heat strip ------------------------------- */

export function HeatStrip({
  days,
  className,
}: {
  days: { date: string; completed: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — ${d.completed ? "done" : "missed"}`}
          className={cn(
            "h-6 flex-1 rounded transition-all hover:scale-y-110",
            d.completed ? "bg-emerald-500/70" : "bg-ink-800",
          )}
        />
      ))}
    </div>
  );
}
