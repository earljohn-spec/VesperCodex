import Link from "next/link";
import { Moon } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left: pitch */}
      <div className="relative hidden overflow-hidden border-r border-ink-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 top-1/4 h-[420px] w-[420px] rounded-full bg-vesper-600/16 blur-3xl animate-breathe" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-calm-500/10 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-vesper-600 shadow-lg shadow-vesper-950/50">
            <Moon className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Vesper</span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white">
            A companion that actually{" "}
            <span className="bg-gradient-to-r from-vesper-300 to-calm-400 bg-clip-text text-transparent">
              remembers you
            </span>
            .
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-300">
            Vesper reads your mood history, your wearable&apos;s stress signals, and what has
            actually worked for you before — then says something useful. No streak guilt, no rigid
            programme, no advice you could have googled.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              ["Context-aware chat", "Grounded in your patterns, not a generic script."],
              ["Biometric stress detection", "HRV dips trigger a two-minute reset, not a lecture."],
              ["Voice journalling", "Speak it. Vesper tags the emotions and charts the trend."],
              ["Works offline", "Everything captures locally and syncs when you reconnect."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vesper-400 shadow-[0_0_10px_2px_rgba(157,124,255,0.5)]" />
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-[13px] leading-relaxed text-ink-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs leading-relaxed text-ink-500">
          Vesper is a wellness tool, not a medical device or a replacement for professional care.
          If you are in crisis, please contact your local emergency services or a crisis line.
        </p>
      </div>

      {/* right: form */}
      <div className="flex flex-col items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-vesper-600">
              <Moon className="h-4.5 w-4.5 text-white" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">Vesper</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
