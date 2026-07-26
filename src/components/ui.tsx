"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

/* --------------------------------- Button -------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-vesper-600 text-white hover:bg-vesper-500 shadow-lg shadow-vesper-950/40 border border-vesper-500/40",
  secondary: "bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-700",
  ghost: "text-ink-300 hover:text-white hover:bg-ink-800/70",
  danger: "bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-500/40",
  outline: "border border-ink-600 text-ink-200 hover:bg-ink-800/60 hover:text-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all focus-ring",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------------------------------- Card --------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 pb-3", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-vesper-500/12 text-vesper-300">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-400 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* --------------------------------- Badge --------------------------------- */

const BADGE_TONES = {
  neutral: "bg-ink-800 text-ink-300 border-ink-700",
  violet: "bg-vesper-500/12 text-vesper-300 border-vesper-500/25",
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  rose: "bg-rose-500/12 text-rose-300 border-rose-500/25",
  sky: "bg-sky-500/12 text-sky-300 border-sky-500/25",
  indigo: "bg-indigo-500/12 text-indigo-300 border-indigo-500/25",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Input --------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-ink-700 bg-ink-900/70 px-3.5 py-2.5 text-sm text-white",
          "placeholder:text-ink-500 transition-colors focus-ring",
          "hover:border-ink-600 focus:border-vesper-500/60 disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-xl border border-ink-700 bg-ink-900/70 px-3.5 py-2.5 text-sm text-white",
        "placeholder:text-ink-500 transition-colors focus-ring leading-relaxed",
        "hover:border-ink-600 focus:border-vesper-500/60 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full appearance-none rounded-xl border border-ink-700 bg-ink-900/70 px-3.5 py-2.5 text-sm text-white",
        "transition-colors focus-ring hover:border-ink-600 focus:border-vesper-500/60",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%238b85b4%22 stroke-width=%222%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22/%3E%3C/svg%3E')] bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({
  children,
  className,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("block text-xs font-medium text-ink-300 mb-1.5", className)} {...props}>
      {children}
      {hint && <span className="ml-1.5 font-normal text-ink-500">{hint}</span>}
    </label>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full glass rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up",
          "max-h-[92vh] overflow-y-auto",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-800 p-5">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-xs text-ink-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-800 bg-ink-950/40 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700/80 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-vesper-500/10 text-vesper-300">
        <span className="absolute inset-0 rounded-2xl bg-vesper-500/10 animate-pulse-ring" />
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------- Skeletons ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-5 h-24 w-full" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Toast ---------------------------------- */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = React.createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return React.useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto glass animate-slide-up rounded-xl px-4 py-3 text-sm shadow-xl",
              t.tone === "success" && "border-emerald-500/30 text-emerald-100",
              t.tone === "error" && "border-rose-500/30 text-rose-100",
              t.tone === "info" && "text-ink-100",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------- Confirm --------------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-300">{description}</p>
    </Modal>
  );
}

/* --------------------------------- Tabs ----------------------------------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-ink-800 bg-ink-900/60 p-1",
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-ring whitespace-nowrap",
            value === t.value
              ? "bg-vesper-600 text-white shadow-sm"
              : "text-ink-400 hover:text-ink-100 hover:bg-ink-800/60",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("ml-1.5", value === t.value ? "text-vesper-200" : "text-ink-500")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Progress -------------------------------- */

export function ProgressBar({
  value,
  tone = "violet",
  className,
}: {
  value: number;
  tone?: "violet" | "emerald" | "amber" | "rose" | "sky";
  className?: string;
}) {
  const tones = {
    violet: "bg-vesper-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-800", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------- Tooltip --------------------------------- */

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-[11px] text-ink-100 opacity-0 shadow-xl transition-opacity group-hover/tt:opacity-100">
        {label}
      </span>
    </span>
  );
}
