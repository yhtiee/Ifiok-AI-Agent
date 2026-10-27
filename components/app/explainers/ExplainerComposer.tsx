"use client";

import { MicrophoneIcon, StopIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateExplainer, useSubmitExplainer, type NewExplainer } from "@/lib/queries/contribute";
import { ApiError } from "@/lib/query/api";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Make an explainer (F18, 10 MVP-06): written, a voice note (≤ 5 min) or a short video (≤ 3 min,
// 480p, ≤ 40 MB). Recording happens on the phone: the video is recorded small, a separate audio-only
// track is recorded alongside it (for captions and for data-saver playback, so learners on small
// bundles never download video), and three still frames are sampled for the review. Files go
// straight to a private bucket through signed upload URLs; nothing is visible until it's approved.

type Kind = NewExplainer["kind"];
export type TopicOption = { conceptId: string; title: string; group: string };

const MAX_SECONDS = { voice: 300, video: 180 } as const;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const KIND_LABEL: Record<Kind, string> = { text: "Written", voice: "Voice note", video: "Short video" };

type Recording = { media: Blob | null; audio: Blob; frames: Blob[]; seconds: number; mime: "webm" | "mp4" };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function pickMime(kind: "audio" | "video"): { type: string; ext: "webm" | "mp4" } {
  const options =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const type of options)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type))
      return { type, ext: type.includes("mp4") ? "mp4" : "webm" };
  return { type: "", ext: "webm" };
}

/** Three still frames (at 15%, 50% and 85%) for the review, as small JPEGs. */
async function sampleFrames(video: Blob): Promise<Blob[]> {
  const url = URL.createObjectURL(video);
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      el.onloadedmetadata = () => ok();
      el.onerror = () => fail(new Error("frames"));
    });
    // Recorded WebM often reports Infinity until seeked to the end.
    if (!Number.isFinite(el.duration)) {
      el.currentTime = 1e9;
      await new Promise((ok) => (el.ondurationchange = ok));
    }
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
    const canvas = document.createElement("canvas");
    const out: Blob[] = [];
    for (const at of [0.15, 0.5, 0.85]) {
      el.currentTime = duration * at;
      await new Promise((ok) => (el.onseeked = ok));
      const scale = Math.min(1, 480 / (el.videoHeight || 480));
      canvas.width = Math.round((el.videoWidth || 640) * scale);
      canvas.height = Math.round((el.videoHeight || 480) * scale);
      canvas.getContext("2d")?.drawImage(el, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.7));
      if (blob) out.push(blob);
    }
    return out;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExplainerComposer(props: { topics: TopicOption[]; initialConcept: string | null }) {
  const router = useRouter();
  const create = useCreateExplainer();
  const submit = useSubmitExplainer();
  const ids = { topic: useId(), title: useId(), body: useId() };
  const [concept, setConcept] = useState(props.initialConcept ?? props.topics[0]?.conceptId ?? "");
  const [kind, setKind] = useState<Kind>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = [...new Set(props.topics.map((t) => t.group))];

  const send = async () => {
    setError(null);
    if (!concept) return setError("Pick the topic you're explaining.");
    if (title.trim().length < 3) return setError("Give it a title of at least 3 characters.");
    if (kind === "text" && body.trim().length < 80) return setError("Write at least a few sentences.");
    if (kind !== "text" && !recording) return setError("Record your explainer first.");
    if (recording?.media && recording.media.size > MAX_VIDEO_BYTES)
      return setError("The video is over 40 MB. Record a shorter one.");
    try {
      setSending("Saving…");
      const made = await create.mutateAsync({
        concept_id: concept,
        kind,
        title: title.trim(),
        ...(kind === "text"
          ? { body_md: body.trim() }
          : {
              media: {
                audio_bytes: recording!.audio.size,
                ...(recording!.media ? { video_bytes: recording!.media.size } : {}),
                mime: recording!.mime,
              },
            }),
      });
      if (made.uploads && recording) {
        const bucket = createClient().storage.from("explainers");
        const put = async (target: { path: string; token: string }, blob: Blob, type: string) => {
          const { error: e } = await bucket.uploadToSignedUrl(target.path, target.token, blob, { contentType: type });
          if (e) throw new Error("upload");
        };
        setSending("Uploading the audio…");
        await put(made.uploads.audio!, recording.audio, recording.mime === "mp4" ? "audio/mp4" : "audio/webm");
        if (made.uploads.video && recording.media) {
          setSending(`Uploading the video (${mb(recording.media.size)})…`);
          await put(made.uploads.video, recording.media, recording.mime === "mp4" ? "video/mp4" : "video/webm");
          for (const [i, frame] of recording.frames.entries())
            if (made.uploads.frames[i]) await put(made.uploads.frames[i], frame, "image/jpeg");
        }
        setSending("Sending it for review…");
        await submit.mutateAsync(made.id);
      }
      toast("Sent for review. It appears for other students once it's approved.");
      router.push("/me/explainers");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "The upload didn't finish. Check your connection and send it again.",
      );
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <label htmlFor={ids.topic} className="grid gap-1.5">
        <span className="text-base font-semibold">Topic</span>
        <select
          id={ids.topic}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          className={cn(fieldClass, "w-full")}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {props.topics
                .filter((t) => t.group === g)
                .map((t) => (
                  <option key={`${g}:${t.conceptId}`} value={t.conceptId}>
                    {t.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label htmlFor={ids.title} className="grid gap-1.5">
        <span className="text-base font-semibold">Title</span>
        <Input
          id={ids.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Loop equations in two steps"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-base font-semibold">Format</legend>
        <div className="flex flex-wrap gap-2">
          {(["text", "voice", "video"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant={kind === k ? "default" : "outline"}
              className={kind === k ? "bg-quantity text-paper hover:bg-quantity" : undefined}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setRecording(null);
              }}
            >
              {KIND_LABEL[k]}
            </Button>
          ))}
        </div>
      </fieldset>

      {kind === "text" ? (
        <label htmlFor={ids.body} className="grid gap-1.5">
          <span className="text-base font-semibold">Your explanation</span>
          <span className="text-sm text-ink-2">Write maths between dollar signs, like $V = IR$.</span>
          <Textarea id={ids.body} value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={12_000} />
        </label>
      ) : (
        <Recorder key={kind} kind={kind} onDone={setRecording} done={recording} />
      )}

      <p className="text-sm text-ink-2">
        Explain it in your own words. Show only yourself on camera, and no contact details. A person checks every
        explainer before other students see it.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <ActionBar>
        <Button onClick={send} disabled={Boolean(sending)} aria-busy={Boolean(sending)}>
          {sending ?? "Send for review"}
        </Button>
      </ActionBar>
    </div>
  );
}

function Recorder(props: { kind: "voice" | "video"; done: Recording | null; onDone: (r: Recording | null) => void }) {
  const preview = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = MAX_SECONDS[props.kind];
  // A local preview of the finished recording; the URL is released when it changes.
  const playback = useMemo(
    () => (props.done ? URL.createObjectURL(props.done.media ?? props.done.audio) : null),
    [props.done],
  );

  useEffect(() => () => stop.current?.(), []);
  useEffect(() => () => (playback ? URL.revokeObjectURL(playback) : undefined), [playback]);

  const start = async () => {
    setError(null);
    props.onDone(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        props.kind === "video"
          ? { audio: true, video: { height: { ideal: 480 }, width: { ideal: 640 }, facingMode: "user" } }
          : { audio: true },
      );
    } catch {
      return setError("Ifiok can't use your microphone or camera. Allow it in your browser and try again.");
    }
    const audioMime = pickMime("audio");
    const audioRec = new MediaRecorder(new MediaStream(stream.getAudioTracks()), {
      ...(audioMime.type ? { mimeType: audioMime.type } : {}),
      audioBitsPerSecond: 32_000,
    });
    const videoMime = pickMime("video");
    const videoRec =
      props.kind === "video"
        ? new MediaRecorder(stream, {
            ...(videoMime.type ? { mimeType: videoMime.type } : {}),
            videoBitsPerSecond: 900_000,
            audioBitsPerSecond: 32_000,
          })
        : null;
    const audioParts: Blob[] = [];
    const videoParts: Blob[] = [];
    audioRec.ondataavailable = (e) => e.data.size && audioParts.push(e.data);
    if (videoRec) videoRec.ondataavailable = (e) => e.data.size && videoParts.push(e.data);
    const stopped = Promise.all([
      new Promise((ok) => (audioRec.onstop = ok)),
      videoRec ? new Promise((ok) => (videoRec.onstop = ok)) : Promise.resolve(),
    ]);
    if (preview.current && videoRec) {
      preview.current.srcObject = stream;
      void preview.current.play().catch(() => {});
    }
    audioRec.start(1000);
    videoRec?.start(1000);
    setLive(true);
    const began = Date.now();
    setSeconds(0);
    const tick = setInterval(() => {
      const s = (Date.now() - began) / 1000;
      setSeconds(s);
      if (s >= max) stop.current?.();
    }, 250);
    stop.current = () => {
      stop.current = null;
      clearInterval(tick);
      if (audioRec.state !== "inactive") audioRec.stop();
      if (videoRec && videoRec.state !== "inactive") videoRec.stop();
      void stopped.then(async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (preview.current) preview.current.srcObject = null;
        setLive(false);
        const audio = new Blob(audioParts, { type: audioMime.ext === "mp4" ? "audio/mp4" : "audio/webm" });
        const media = videoRec
          ? new Blob(videoParts, { type: videoMime.ext === "mp4" ? "video/mp4" : "video/webm" })
          : null;
        const frames = media ? await sampleFrames(media) : [];
        props.onDone({
          media,
          audio,
          frames,
          seconds: Math.min(max, (Date.now() - began) / 1000),
          mime: (media ? videoMime.ext : audioMime.ext) === "mp4" ? "mp4" : "webm",
        });
      });
    };
  };

  return (
    <div className="grid gap-3">
      {props.kind === "video" ? (
        <video
          ref={preview}
          muted
          playsInline
          aria-label="Camera preview"
          className={cn("aspect-[4/3] w-full max-w-md rounded-[var(--radius-input)] bg-ink/5", live ? "" : "hidden")}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {live ? (
          <Button type="button" variant="outline" onClick={() => stop.current?.()}>
            <StopIcon size={20} aria-hidden="true" /> Stop recording
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={start}>
            {props.kind === "video" ? (
              <VideoCameraIcon size={20} aria-hidden="true" />
            ) : (
              <MicrophoneIcon size={20} aria-hidden="true" />
            )}
            {props.done ? "Record again" : props.kind === "video" ? "Record a video" : "Record a voice note"}
          </Button>
        )}
        <span className="text-base tabular-nums" role="timer" aria-live="off">
          {live ? `${clock(seconds)} of ${clock(max)}` : `Up to ${clock(max)}`}
        </span>
      </div>
      {props.done && playback ? (
        <div className="grid gap-2">
          {props.done.media ? (
            <video src={playback} controls playsInline className="w-full max-w-md rounded-[var(--radius-input)]">
              <track kind="captions" />
            </video>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- the author's own preview; captions come from review
            <audio src={playback} controls className="w-full max-w-md" />
          )}
          <p className="text-sm text-ink-2">
            {clock(props.done.seconds)} · {mb((props.done.media ?? props.done.audio).size)}
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
