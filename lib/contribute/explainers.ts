import "server-only";
import { z } from "zod";
import { BUCKET, LIMITS, framePath } from "@ifiok/core/jobs/explainer";
import { createSupabaseCurateRepo } from "@ifiok/core/jobs/curate";
import { getConfig } from "@/lib/config";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import type { MasteryLevel } from "@/lib/courses/path-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Student explainers (F18, 10 MVP-06, 12 §4 Q57). Media goes straight from the phone to a private
// bucket through signed upload URLs; the `explainer` job checks, transcribes and reviews it; an
// admin approves every MVP explainer before anyone else can see or play it (Q42). Playback uses
// short-lived signed URLs, issued only for approved explainers (or to the author and admins).

const UPLOAD_KINDS = ["voice", "video"] as const;

export const createExplainerBody = z
  .object({
    concept_id: z.string().uuid(),
    kind: z.enum(["text", "voice", "video"]),
    title: z.string().trim().min(3, "Give it a title of at least 3 characters.").max(120),
    body_md: z.string().trim().min(80, "Write at least a few sentences.").max(12_000).optional(),
    media: z
      .object({
        audio_bytes: z
          .number()
          .int()
          .positive()
          .max(LIMITS.audioBytes, "The audio is too large. Record a shorter one."),
        video_bytes: z
          .number()
          .int()
          .positive()
          .max(LIMITS.videoBytes, "The video is over 40 MB. Record a shorter one.")
          .optional(),
        mime: z.enum(["webm", "mp4"]),
      })
      .optional(),
  })
  .superRefine((b, ctx) => {
    if (b.kind === "text" && !b.body_md) ctx.addIssue({ code: "custom", message: "Write your explainer first." });
    if (b.kind !== "text" && !b.media) ctx.addIssue({ code: "custom", message: "Record your explainer first." });
    if (b.kind === "video" && !b.media?.video_bytes)
      ctx.addIssue({ code: "custom", message: "Record your video first." });
  });

export type UploadTarget = { path: string; token: string };
export type CreatedExplainer = {
  id: string;
  uploads: { audio?: UploadTarget; video?: UploadTarget; frames: UploadTarget[] } | null;
};

async function enqueue(explainerId: string, userId: string) {
  const { error } = await createAdminClient().rpc("enqueue_job_once", {
    p_queue: "explainer",
    p_payload: { explainer_id: explainerId, user_id: userId },
    p_dedupe: `explainer:${explainerId}`,
    p_owner: userId,
  });
  if (error) throw new RouteError(503, "Ifiok couldn't send your explainer for review. Try again.", "queue_failed");
}

export async function createExplainer(
  viewer: Viewer,
  body: z.infer<typeof createExplainerBody>,
): Promise<CreatedExplainer> {
  const admin = createAdminClient();
  const { data: concept } = await admin.from("concepts").select("id").eq("id", body.concept_id).maybeSingle();
  if (!concept) throw new RouteError(404, "That topic doesn't exist any more.", "not_found");

  const id = crypto.randomUUID();
  const ext = body.media?.mime === "mp4" ? "mp4" : "webm";
  const audioPath = body.kind === "text" ? null : `${viewer.userId}/${id}/audio.${ext === "mp4" ? "m4a" : "webm"}`;
  const videoPath = body.kind === "video" ? `${viewer.userId}/${id}/video.${ext}` : null;
  const { error } = await admin.from("explainers").insert({
    id,
    author_id: viewer.userId,
    concept_id: body.concept_id,
    kind: body.kind,
    title: body.title,
    body_md: body.kind === "text" ? body.body_md : null,
    audio_path: audioPath,
    media_path: videoPath,
    status: body.kind === "text" ? "processing" : "uploading",
  });
  if (error) throw new RouteError(503, "Ifiok couldn't save your explainer. Try again.", "save_failed");

  if (body.kind === "text") {
    await enqueue(id, viewer.userId);
    return { id, uploads: null };
  }

  // Signed upload URLs tied to this author and this explainer (08 §2.5c).
  const bucket = admin.storage.from(BUCKET);
  const sign = async (path: string): Promise<UploadTarget> => {
    const { data, error: e } = await bucket.createSignedUploadUrl(path);
    if (e || !data) throw new RouteError(503, "Ifiok couldn't prepare the upload. Try again.", "upload_failed");
    return { path, token: data.token };
  };
  return {
    id,
    uploads: {
      audio: await sign(audioPath!),
      ...(videoPath ? { video: await sign(videoPath) } : {}),
      frames: videoPath ? await Promise.all([0, 1, 2].map((i) => sign(framePath(viewer.userId, id, i)))) : [],
    },
  };
}

/** The author's uploads are done: check they arrived, then send the explainer for review. */
export async function submitExplainer(viewer: Viewer, id: string) {
  const admin = createAdminClient();
  const { data: ex } = await admin
    .from("explainers")
    .select("id, author_id, kind, status, audio_path, media_path")
    .eq("id", id)
    .maybeSingle();
  if (!ex || ex.author_id !== viewer.userId) throw new RouteError(404, "That explainer doesn't exist.", "not_found");
  if (ex.status !== "uploading") return { status: ex.status };
  if (!(UPLOAD_KINDS as readonly string[]).includes(ex.kind))
    throw new RouteError(409, "Nothing to upload.", "bad_state");
  const folder = `${viewer.userId}/${id}`;
  const { data: files } = await admin.storage.from(BUCKET).list(folder);
  const names = new Set((files ?? []).map((f) => `${folder}/${f.name}`));
  if (!ex.audio_path || !names.has(ex.audio_path) || (ex.media_path && !names.has(ex.media_path)))
    throw new RouteError(409, "The recording didn't finish uploading. Try again.", "upload_missing");
  await admin.from("explainers").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", id);
  await enqueue(id, viewer.userId);
  return { status: "processing" };
}

export type ExplainerView = {
  id: string;
  title: string;
  kind: "text" | "voice" | "video";
  status: string;
  reason: string | null;
  body: string | null;
  transcript: string | null;
  captions: { start: number; end: number; text: string }[];
  durationS: number | null;
  videoBytes: number | null;
  audioBytes: number | null;
  numbersChecked: boolean | null;
  author: { name: string; mastery: MasteryLevel | null; isYou: boolean };
  concept: { id: string; title: string };
  createdAt: string;
};

type Row = {
  id: string;
  author_id: string;
  concept_id: string;
  kind: string;
  title: string;
  status: string;
  review_reason: string | null;
  body_md: string | null;
  transcript: string | null;
  captions: unknown;
  duration_s: number | null;
  media_bytes: number | null;
  audio_bytes: number | null;
  numbers_checked: boolean | null;
  created_at: string;
};
const COLUMNS =
  "id, author_id, concept_id, kind, title, status, review_reason, body_md, transcript, captions, duration_s, media_bytes, audio_bytes, numbers_checked, created_at";

/** Display names and each author's mastery of the explainer's topic (server-read; F18-FR1). */
async function views(viewer: Viewer, rows: Row[]): Promise<ExplainerView[]> {
  if (!rows.length) return [];
  const admin = createAdminClient();
  const authors = [...new Set(rows.map((r) => r.author_id))];
  const conceptIds = [...new Set(rows.map((r) => r.concept_id))];
  const [{ data: people }, { data: mastery }, { data: concepts }] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", authors),
    admin.from("mastery").select("user_id, concept_id, level").in("user_id", authors).in("concept_id", conceptIds),
    admin.from("concepts").select("id, title").in("id", conceptIds),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  const title = new Map((concepts ?? []).map((c) => [c.id, c.title]));
  return rows.map((r) => {
    const level = (mastery ?? []).find((m) => m.user_id === r.author_id && m.concept_id === r.concept_id)?.level;
    return {
      id: r.id,
      title: r.title,
      kind: r.kind as ExplainerView["kind"],
      status: r.status,
      reason: r.review_reason,
      body: r.body_md,
      transcript: r.transcript,
      captions: Array.isArray(r.captions) ? (r.captions as ExplainerView["captions"]) : [],
      durationS: r.duration_s === null ? null : Number(r.duration_s),
      videoBytes: r.media_bytes,
      audioBytes: r.audio_bytes,
      numbersChecked: r.numbers_checked,
      author: {
        name: name.get(r.author_id) ?? "A student",
        // Mastery only from server-written evidence, and "Not started" isn't a signal worth showing.
        mastery: level && level !== "not_started" ? (level as MasteryLevel) : null,
        isYou: r.author_id === viewer.userId,
      },
      concept: { id: r.concept_id, title: title.get(r.concept_id) ?? "Topic" },
      createdAt: r.created_at,
    };
  });
}

/** Approved explainers for a topic (RLS: approved, or the viewer's own). */
export async function explainersForConcept(viewer: Viewer, conceptId: string): Promise<ExplainerView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("explainers")
    .select(COLUMNS)
    .eq("concept_id", conceptId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(20);
  return views(viewer, (data ?? []) as Row[]);
}

/** How many approved explainers each topic has (for the Path and "A student explains this"). */
export async function explainerCounts(conceptIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!conceptIds.length) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("explainers")
    .select("concept_id")
    .in("concept_id", conceptIds)
    .eq("status", "approved");
  for (const r of data ?? []) out.set(r.concept_id, (out.get(r.concept_id) ?? 0) + 1);
  return out;
}

export async function myExplainers(viewer: Viewer): Promise<ExplainerView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("explainers")
    .select(COLUMNS)
    .eq("author_id", viewer.userId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  return views(viewer, (data ?? []) as Row[]);
}

export const mediaBody = z.object({ part: z.enum(["audio", "video"]) });

/** A short-lived playback URL: approved explainers for anyone; the author and admins any time. */
export async function mediaUrl(viewer: Viewer, id: string, part: "audio" | "video"): Promise<{ url: string }> {
  const admin = createAdminClient();
  const { data: ex } = await admin
    .from("explainers")
    .select("author_id, status, audio_path, media_path")
    .eq("id", id)
    .maybeSingle();
  const allowed = ex && (ex.status === "approved" || ex.author_id === viewer.userId || viewer.profile.role === "admin");
  const path = part === "video" ? ex?.media_path : ex?.audio_path;
  if (!ex || !allowed || !path) throw new RouteError(404, "That explainer isn't available.", "not_found");
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) throw new RouteError(503, "Ifiok couldn't load the recording. Try again.", "media_failed");
  return { url: data.signedUrl };
}

/** A student finished an explainer: one usage point per (explainer, student, month), never self. */
export async function finishExplainer(viewer: Viewer, id: string): Promise<{ recorded: boolean }> {
  const { data, error } = await createAdminClient().rpc("record_usage", {
    p_kind: "explainer",
    p_resource: id,
    p_consumer: viewer.userId,
  });
  if (error) throw new RouteError(503, "Ifiok couldn't record that. It doesn't affect you.", "usage_failed");
  return { recorded: Boolean(data) };
}

async function deleteMedia(authorId: string, id: string) {
  const admin = createAdminClient();
  const folder = `${authorId}/${id}`;
  const { data: files } = await admin.storage.from(BUCKET).list(folder);
  if (files?.length) await admin.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
}

/** The author withdraws it (F18-FR1): hidden at once, media deleted (08 §2.5c: within 7 days). */
export async function withdrawExplainer(viewer: Viewer, id: string) {
  const admin = createAdminClient();
  const { data: ex } = await admin.from("explainers").select("author_id").eq("id", id).maybeSingle();
  if (!ex || ex.author_id !== viewer.userId) throw new RouteError(404, "That explainer doesn't exist.", "not_found");
  await admin
    .from("explainers")
    .update({ status: "withdrawn", transcript: null, captions: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  await deleteMedia(viewer.userId, id);
}

// ---------------------------------------------------------------------------
// Reports (08 §7b): 3 from distinct students hide an explainer until an admin looks at it.
// ---------------------------------------------------------------------------

export const reportBody = z.object({
  reason: z.string().trim().min(3, "Say what's wrong in a few words.").max(300),
});

export async function reportExplainer(viewer: Viewer, id: string, reason: string): Promise<{ reported: boolean }> {
  const { data, error } = await createAdminClient().rpc("report_explainer", {
    p_explainer: id,
    p_reporter: viewer.userId,
    p_reason: reason,
  });
  if (error) throw new RouteError(503, "Ifiok couldn't send the report. Try again.", "report_failed");
  return { reported: Number(data) > 0 };
}

// ---------------------------------------------------------------------------
// The admin section (12 §4 Q58): what the checks held, new authors' first explainers, reported
// ones, held shares, and a few auto-published explainers to spot-check.
// ---------------------------------------------------------------------------

type QueueExplainer = ExplainerView & { issues: string[]; reports: string[] };

export type ReviewQueue = {
  review: QueueExplainer[];
  reported: QueueExplainer[];
  spotChecks: QueueExplainer[];
  shares: { id: string; title: string; kind: string; reason: string | null; owner: string; createdAt: string }[];
};

export async function reviewQueue(viewer: Viewer): Promise<ReviewQueue> {
  const admin = createAdminClient();
  const moderation = await getConfig("moderation");
  const select = `${COLUMNS}, ai_review`;
  const [{ data: review }, { data: reported }, { data: spot }, { data: shares }] = await Promise.all([
    admin.from("explainers").select(select).in("status", ["pending_admin", "held"]).order("created_at").limit(50),
    admin.from("explainers").select(select).eq("status", "hidden").order("updated_at").limit(50),
    admin
      .from("explainers")
      .select(select)
      .eq("status", "approved")
      .eq("auto_published", true)
      .is("spot_checked_at", null)
      .order("approved_at", { ascending: false })
      .limit(moderation.spot_checks),
    admin
      .from("sources")
      .select("id, title, kind, review_reason, owner_id, shared_at")
      .not("shared_at", "is", null)
      .eq("review", "needs_review")
      .order("shared_at")
      .limit(50),
  ]);
  const hiddenIds = (reported ?? []).map((r) => r.id);
  const { data: reports } = hiddenIds.length
    ? await admin.from("explainer_reports").select("explainer_id, reason").in("explainer_id", hiddenIds)
    : { data: [] as { explainer_id: string; reason: string }[] };
  const withNotes = async (rows: unknown[] | null) => {
    const list = await views(viewer, (rows ?? []) as Row[]);
    return list.map((v, i) => ({
      ...v,
      issues: ((rows?.[i] as { ai_review?: { issues?: string[] } } | undefined)?.ai_review?.issues ?? []).slice(0, 12),
      reports: (reports ?? []).filter((r) => r.explainer_id === v.id).map((r) => r.reason),
    }));
  };
  const owners = [...new Set((shares ?? []).map((s) => s.owner_id))];
  const { data: people } = owners.length
    ? await admin.from("profiles").select("id, display_name").in("id", owners)
    : { data: [] as { id: string; display_name: string | null }[] };
  return {
    review: await withNotes(review),
    reported: await withNotes(reported),
    spotChecks: await withNotes(spot),
    shares: (shares ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      reason: s.review_reason,
      owner: people?.find((p) => p.id === s.owner_id)?.display_name ?? "A student",
      createdAt: s.shared_at!,
    })),
  };
}

export const decisionBody = z.object({
  /** approve: publish (or restore after reports); keep: a spot-checked one is fine; reject: take it down. */
  decision: z.enum(["approve", "keep", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

export async function decideExplainer(viewer: Viewer, id: string, body: z.infer<typeof decisionBody>) {
  const admin = createAdminClient();
  const { data: ex } = await admin.from("explainers").select("author_id, status").eq("id", id).maybeSingle();
  if (!ex || !["pending_admin", "held", "hidden", "approved"].includes(ex.status))
    throw new RouteError(409, "That explainer isn't waiting for review.", "bad_state");
  const now = new Date().toISOString();
  if (body.decision === "keep") {
    if (ex.status !== "approved") throw new RouteError(409, "Only a live explainer can be kept.", "bad_state");
    await admin.from("explainers").update({ spot_checked_at: now, updated_at: now }).eq("id", id);
  } else if (body.decision === "approve") {
    // Restoring a reported explainer clears its reports, so it isn't hidden again by the same ones.
    if (ex.status === "hidden") await admin.from("explainer_reports").delete().eq("explainer_id", id);
    await admin
      .from("explainers")
      .update({
        status: "approved",
        review_reason: null,
        approved_by: viewer.userId,
        approved_at: now,
        spot_checked_at: now,
        updated_at: now,
      })
      .eq("id", id);
  } else {
    await admin
      .from("explainers")
      .update({
        status: "rejected",
        review_reason: body.reason || "It didn't pass review.",
        transcript: null,
        captions: null,
        updated_at: now,
      })
      .eq("id", id);
    // Rejected media and its transcript are deleted (08 §2.5c).
    await deleteMedia(ex.author_id, id);
  }
  await admin.from("admin_audit").insert({
    admin_id: viewer.userId,
    action: `explainer_${body.decision}`,
    target: id,
    detail: body.reason ? { reason: body.reason } : {},
  });
}

export async function decideShare(viewer: Viewer, id: string, body: z.infer<typeof decisionBody>) {
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("sources")
    .select("owner_id, kind, review, shared_at, shared_concepts")
    .eq("id", id)
    .maybeSingle();
  if (!s?.shared_at || s.review !== "needs_review")
    throw new RouteError(409, "That material isn't waiting for review.", "bad_state");
  const repo = createSupabaseCurateRepo(admin);
  if (body.decision === "reject") {
    await repo.setReview(id, "rejected", body.reason || "It can't be shared to the library.");
  } else {
    let concepts = s.shared_concepts ?? [];
    if (!concepts.length) concepts = (await repo.candidates(id)).slice(0, 1).map((c) => c.id);
    if (!concepts.length) throw new RouteError(409, "Ifiok couldn't match it to any topic.", "no_topic");
    await repo.approve(id, concepts);
    const usage = await getConfig("usage");
    await repo.awardUnits(s.owner_id, usage.approved_upload_units, `upload:${id}`);
    if (s.kind !== "past_paper")
      for (const c of await repo.topicsWithoutSourcedLesson(concepts)) await repo.queueSharedLesson(c);
  }
  await admin.from("admin_audit").insert({
    admin_id: viewer.userId,
    action: `share_${body.decision}`,
    target: id,
    detail: body.reason ? { reason: body.reason } : {},
  });
}

// ---------------------------------------------------------------------------
// The Library's watch page (12 §4 Q58). The Library list itself is lib/contribute/library.ts.
// ---------------------------------------------------------------------------

/** One live explainer for its watch page, with more on the same topic. */
export async function watchExplainer(
  viewer: Viewer,
  id: string,
): Promise<{ explainer: ExplainerView; more: ExplainerView[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("explainers")
    .select(COLUMNS)
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) return null;
  const [explainer] = await views(viewer, [data as Row]);
  const more = (await explainersForConcept(viewer, data.concept_id)).filter((e) => e.id !== id).slice(0, 6);
  return { explainer: explainer!, more };
}
