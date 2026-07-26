import Link from "next/link";
import { Moon } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-vesper-600 shadow-lg shadow-vesper-950/50">
          <Moon className="h-5 w-5 text-white" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          The link may be old, or the page may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-vesper-600 px-5 text-sm font-medium text-white transition-colors hover:bg-vesper-500 focus-ring"
        >
          Back to today
        </Link>
      </div>
    </div>
  );
}
