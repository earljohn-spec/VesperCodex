"use client";

import * as React from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Voice-to-text via the browser's Web Speech API.
 *
 * Chrome/Edge/Safari support this natively, so no audio ever leaves the
 * device and it costs nothing. Browsers without it (Firefox) fall back to a
 * clear message rather than a broken button.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/** Capability never changes at runtime, so the store has no updates. */
const subscribeNever = () => () => {};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoiceRecorder({
  onTranscript,
  onDurationChange,
  className,
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onDurationChange?: (ms: number) => void;
  className?: string;
}) {
  // Feature detection has to run client-side only, or SSR and the client
  // disagree. useSyncExternalStore gives us a null server snapshot and the
  // real answer on the client without a state-setting effect.
  const supported = React.useSyncExternalStore(
    subscribeNever,
    () => getRecognition() !== null,
    () => null,
  );
  const [recording, setRecording] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seconds, setSeconds] = React.useState(0);

  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const startedAt = React.useRef<number>(0);
  const baseText = React.useRef<string>("");

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [recording]);

  function stop() {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
    onDurationChange?.(Date.now() - startedAt.current);
  }

  function start() {
    const rec = getRecognition();
    if (!rec) return;

    setError(null);
    baseText.current = "";
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      if (final) {
        baseText.current += final;
        onTranscript(baseText.current.trim(), true);
      } else if (interim) {
        onTranscript((baseText.current + interim).trim(), false);
      }
    };

    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microphone permission denied."
          : e.error === "no-speech"
            ? "Didn't catch that — try again."
            : "Voice capture failed.",
      );
      setRecording(false);
    };

    rec.onend = () => setRecording(false);

    recRef.current = rec;
    startedAt.current = Date.now();
    setSeconds(0);
    setRecording(true);
    rec.start();
  }

  if (supported === false) {
    return (
      <p className={cn("text-[11px] leading-relaxed text-ink-500", className)}>
        Voice capture needs Chrome, Edge or Safari. You can still type your entry.
      </p>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={recording ? stop : start}
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all focus-ring",
          recording
            ? "bg-rose-500 text-white"
            : "bg-vesper-600 text-white hover:bg-vesper-500 active:scale-95",
        )}
        aria-label={recording ? "Stop recording" : "Start voice entry"}
      >
        {recording && <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-pulse-ring" />}
        {supported === null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>

      <div className="min-w-0">
        {recording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tabular-nums text-white">
                {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
              <span className="flex items-end gap-0.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-0.5 animate-pulse rounded-full bg-rose-400"
                    style={{
                      height: `${6 + ((i * 5) % 12)}px`,
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </span>
            </div>
            <p className="text-[11px] text-ink-400">Listening — tap to stop</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-white">Speak your entry</p>
            <p className="text-[11px] text-ink-500">
              {error ?? "Transcribed on-device. Nothing is uploaded."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
