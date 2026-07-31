"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookHeart,
  Brain,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleHeart,
  Moon,
  Repeat2,
  Settings,
  Wind,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { OfflineBadge } from "./offline";
import { clearOfflineData } from "./service-worker";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/chat", label: "Companion", icon: MessageCircleHeart },
  { href: "/journal", label: "Journal", icon: BookHeart },
  { href: "/habits", label: "Habits", icon: Repeat2 },
  { href: "/biometrics", label: "Biometrics", icon: Activity },
  { href: "/breaks", label: "Micro-breaks", icon: Wind },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  user,
  pendingCount = 0,
  activeBreaks = 0,
}: {
  user: User;
  pendingCount?: number;
  activeBreaks?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the mobile drawer on navigation.
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  const nav = (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 focus-ring rounded-lg">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-vesper-600 shadow-lg shadow-vesper-950/50">
            <Moon className="h-4 w-4 text-white" />
          </span>
          <span className="text-base font-semibold tracking-tight text-white">Vesper</span>
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white lg:hidden focus-ring"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <OfflineBadge pendingCount={pendingCount} />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const badge = href === "/breaks" && activeBreaks > 0 ? activeBreaks : null;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all focus-ring",
                active
                  ? "bg-vesper-500/12 text-white"
                  : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-100",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-vesper-400" />
              )}
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-colors",
                  active ? "text-vesper-300" : "text-ink-500 group-hover:text-ink-300",
                )}
              />
              <span className="flex-1 truncate">{label}</span>
              {badge && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-300">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ring-2 ring-ink-800"
            style={{
              background: `linear-gradient(140deg, hsl(${user.avatarHue} 70% 58%), hsl(${(user.avatarHue + 45) % 360} 72% 44%))`,
            }}
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-ink-500">{user.email}</p>
          </div>
          <form action={logoutAction} onSubmit={() => clearOfflineData()}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-800 hover:text-rose-300 focus-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-300 hover:bg-ink-800 hover:text-white focus-ring"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-vesper-600">
            <Moon className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="font-semibold tracking-tight text-white">Vesper</span>
        </Link>
        <div className="ml-auto">
          <OfflineBadge pendingCount={pendingCount} compact />
        </div>
      </header>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[17rem] flex-col border-r border-ink-800 bg-ink-950 animate-slide-up">
            {nav}
          </aside>
        </div>
      )}

      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col border-r border-ink-800 bg-ink-950/60 backdrop-blur lg:flex">
        {nav}
      </aside>
    </>
  );
}
