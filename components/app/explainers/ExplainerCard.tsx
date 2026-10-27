"use client";

import { CheckCircleIcon, PlayIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MathHtmlProvider, RichText } from "@/components/lesson/RichText";
import { Button } from "@/components/ui/button";
import { explainerMediaUrl, finishExplainer, useReportExplainer } from "@/lib/queries/contribute";
import { ApiError } from "@/lib/query/api";

// One student explainer (F18-FR5): never auto-plays, captions on, and the size is shown before
// anything downloads. In data-saver mode (the switch, or the phone's own data saver) a video
// explainer plays its audio-only track with the transcript; the video file is never requested.
// Finishing it (the end of the text, or 80% played) records one usage point for its author.

export type ExplainerCardView = {
  id: string;
  title: string;
  kind: "text" | "voice" | "video";
  body: string | null;
  transcript: string | null;
  captions: { start: number; end: number; text: string }[];
  durationS: number | null;
  videoBytes: number | null;
  audioBytes: number | null;
  numbersChecked: boolean | null;
  author: { name: string; mastery: string | null; isYou: boolean };
};

const MASTERY_WORDS: Record<string, string> = { familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };
const mb = (bytes: number | null) => (bytes ? `≈ ${Math.max(0.1, bytes / 1024 / 1024).toFixed(1)} MB` : "");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---- Data saver: a per-device switch, defaulting to the phone's own setting ------------------
const KEY = "ifiok.dataSaver";
const listeners = new Set<() => void>();
function readSaver(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === "1";
  } catch {
    // Storage blocked: fall through to the phone's setting.
  }
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}
export function useDataSaver(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    readSaver,
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // Not saved on this device; it still applies to this visit.
    }
    listeners.forEach((l) => l());
  };
  return [on, set];
}

export function DataSaverSwitch() {
  const [on, set] = useDataSaver();
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-base">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-5 w-5" />
      Data saver: transcript and audio only
    </label>
  );
}

/** WebVTT from the Whisper segments, for the video's caption track. */
function vtt(captions: ExplainerCardView["captions"]): string {
  const t = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(3).padStart(6, "0");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec}`;
  };
  return `WEBVTT\n\n${captions.map((c, i) => `${i + 1}\n${t(c.start)} --> ${t(Math.max(c.end, c.start + 0.5))}\n${c.text}`).join("\n\n")}\n`;
}

export function ExplainerCard({
  ex,
  math,
  reportable = true,
}: {
  ex: ExplainerCardView;
  math: Record<string, string>;
  /** Off in the admin section. */
  reportable?: boolean;
}) {
  const [saver] = useDataSaver();
  const [src, setSrc] = useState<{ part: "audio" | "video"; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  const finish = () => {
    if (sent.current || ex.author.isYou) return;
    sent.current = true;
    setFinished(true);
    void finishExplainer(ex.id).catch(() => {
      sent.current = false;
    });
  };

  // A written explainer counts as finished when its end scrolls into view.
  useEffect(() => {
    if (ex.kind !== "text" || !end.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && finish());
    io.observe(end.current);
    return () => io.disconnect();
  });

  const captionsUrl = useMemo(
    () =>
      ex.captions.length && typeof window !== "undefined"
        ? URL.createObjectURL(new Blob([vtt(ex.captions)], { type: "text/vtt" }))
        : null,
    [ex.captions],
  );
  useEffect(() => () => (captionsUrl ? URL.revokeObjectURL(captionsUrl) : undefined), [captionsUrl]);

  const load = async (part: "audio" | "video") => {
    setError(null);
    setLoading(true);
    try {
      setSrc({ part, url: (await explainerMediaUrl(ex.id, part)).url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The recording didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  };
  const onTime = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const m = e.currentTarget;
    const total = Number.isFinite(m.duration) && m.duration > 0 ? m.duration : (ex.durationS ?? 0);
    if (total && m.currentTime / total >= 0.8) finish();
  };

  const showVideo = ex.kind === "video" && !saver;
  const meta = [
    ex.author.isYou ? "You" : ex.author.name,
    ex.author.mastery ? `${MASTERY_WORDS[ex.author.mastery]} on Ifiok` : null,
    ex.kind === "text" ? "Written" : ex.kind === "voice" ? "Voice note" : "Video",
    ex.durationS ? clock(ex.durationS) : null,
  ].filter(Boolean);

  return (
    <article aria-labelledby={`ex-${ex.id}`} className="grid gap-3 border-t border-line pt-4">
      <header className="grid gap-0.5">
        <h3 id={`ex-${ex.id}`} className="text-base font-semibold">
          {ex.title}
        </h3>
        <p className="text-sm text-ink-2">
          {meta.join(" · ")}
          {ex.numbersChecked === false ? " · Numbers not checked" : ""}
        </p>
      </header>

      {ex.kind === "text" && ex.body ? (
        <MathHtmlProvider value={math}>
          <div className="text-base leading-relaxed whitespace-pre-line">
            <RichText text={ex.body} />
          </div>
          <div ref={end} aria-hidden="true" />
        </MathHtmlProvider>
      ) : null}

      {ex.kind !== "text" ? (
        <div className="grid gap-2">
          {src ? (
            src.part === "video" ? (
              <video
                src={src.url}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={onTime}
                className="w-full max-w-xl rounded-[var(--radius-input)] bg-ink/5"
              >
                <track kind="captions" src={captionsUrl ?? undefined} srcLang="en" label="English" default />
              </video>
            ) : (
              // Voice notes and data-saver playback: the transcript below is the text alternative.
              // eslint-disable-next-line jsx-a11y/media-has-caption -- the full transcript is shown with it
              <audio src={src.url} controls preload="metadata" onTimeUpdate={onTime} className="w-full max-w-xl" />
            )
          ) : (
            <div>
              {showVideo ? (
                <Button variant="outline" onClick={() => load("video")} disabled={loading} aria-busy={loading}>
                  <VideoCameraIcon size={20} aria-hidden="true" /> Load video ({mb(ex.videoBytes)})
                </Button>
              ) : (
                <Button variant="outline" onClick={() => load("audio")} disabled={loading} aria-busy={loading}>
                  <PlayIcon size={20} aria-hidden="true" /> Load audio ({mb(ex.audioBytes)})
                </Button>
              )}
            </div>
          )}
          {ex.transcript && (!showVideo || src?.part !== "video") ? (
            <details open={ex.kind === "video" && saver} className="text-base">
              <summary className="min-h-11 cursor-pointer py-2 text-ink-2">Transcript</summary>
              <p className="leading-relaxed whitespace-pre-line">{ex.transcript}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      {reportable && !ex.author.isYou ? <ReportLink id={ex.id} /> : null}
      {finished ? (
        <p className="flex items-center gap-1.5 text-sm text-built">
          <CheckCircleIcon size={16} weight="fill" aria-hidden="true" /> Finished. Thanks to {ex.author.name} for
          explaining it.
        </p>
      ) : null}
    </article>
  );
}

/** Report: a short reason; 3 reports from different students hide it for an admin (08 §7b). */
function ReportLink({ id }: { id: string }) {
  const report = useReportExplainer();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (report.isSuccess) return <p className="text-sm text-ink-2">Reported. Thanks: an admin will look at it.</p>;
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-self-start text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        Report
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length >= 3) report.mutate({ id, reason: reason.trim() });
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="What's wrong with it?"
        aria-label="What's wrong with it?"
        className="min-h-11 flex-1 rounded-[var(--radius-input)] border border-line bg-surface px-3 text-base"
      />
      <Button type="submit" variant="outline" size="sm" disabled={reason.trim().length < 3 || report.isPending}>
        Send report
      </Button>
      {report.isError ? (
        <p role="alert" className="w-full text-sm text-bad">
          {report.error instanceof ApiError ? report.error.message : "The report didn't send. Try again."}
        </p>
      ) : null}
    </form>
  );
}
