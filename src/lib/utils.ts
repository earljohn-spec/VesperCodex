import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* --------------------------------- dates -------------------------------- */

export function toDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function relativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString(
    undefined,
    opts ?? { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* --------------------------------- misc --------------------------------- */

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function pluralize(n: number, singular: string, plural?: string) {
  return n === 1 ? singular : (plural ?? `${singular}s`);
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function titleCase(s: string) {
  return s.replace(/(^|\s|_)\w/g, (m) => m.toUpperCase()).replace(/_/g, " ");
}
