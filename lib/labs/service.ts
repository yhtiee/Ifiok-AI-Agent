import "server-only";
import { z } from "zod";
import { compareRun, type LabComparison } from "@ifiok/core/labs/compare";
import { readingsFor, type SettingReadings } from "@ifiok/core/labs/engine";
import { compileExperiment, experimentConfig, type PublicExperiment } from "@ifiok/core/labs/experiment";
import { topicKey } from "@ifiok/core/jobs/lab-extract";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

// Virtual labs (F4 amended, 05 §9, 10 MVP-05). A lab's full configuration, with the true constants,
// stays on the server: the browser gets the public configuration, then readings for one seed, and
// the accepted value only when the student compares their own result. Runs are server-written.

export type LabRow = {
  id: string;
  title: string;
  origin: "manual" | "topic";
  status: "ready" | "declined";
  reason: string | null;
  courseId: string | null;
  courseCode: string | null;
  sourceTitle: string | null;
  runs: number;
  /** The latest run's error against the accepted value, in %. */
  lastErrorPct: number | null;
};

export type LabRequest = {
  jobId: string;
  label: string;
  courseId: string | null;
  status: "building" | "declined" | "failed";
  reason: string | null;
};

export type LabsView = { labs: LabRow[]; requests: LabRequest[] };

const REQUEST_WINDOW_MS = 24 * 3600 * 1000;

async function requireMember(viewer: Viewer, courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  if (!data) throw new RouteError(403, "Join the course to add labs to it.", "not_member");
}

/** The student's labs (all, or one course's), and their lab requests from the last day. */
export async function getLabs(viewer: Viewer, courseId?: string): Promise<LabsView> {
  const supabase = await createClient();
  let links = supabase
    .from("user_labs")
    .select("lab_id, course_id, created_at, labs(id, title, origin, status, decline_reason, source_id)")
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: false });
  if (courseId) links = links.eq("course_id", courseId);
  const since = new Date(Date.now() - REQUEST_WINDOW_MS).toISOString();
  const [{ data: rows }, { data: jobs }, { data: runs }] = await Promise.all([
    links,
    supabase
      .from("jobs")
      .select("id, status, payload, result, error, created_at")
      .eq("queue", "lab_extract")
      .eq("owner_id", viewer.userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("lab_runs")
      .select("lab_id, result, created_at")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: false }),
  ]);

  const courseIds = [...new Set((rows ?? []).flatMap((r) => (r.course_id ? [r.course_id] : [])))];
  const sourceIds = [...new Set((rows ?? []).flatMap((r) => (r.labs?.source_id ? [r.labs.source_id] : [])))];
  const jobSources = (jobs ?? []).flatMap((j) => {
    const p = j.payload as { mode?: string; source_id?: string };
    return p.mode === "manual" && p.source_id ? [p.source_id] : [];
  });
  const [{ data: courses }, { data: sources }] = await Promise.all([
    courseIds.length
      ? supabase.from("courses").select("id, code").in("id", courseIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    sourceIds.length || jobSources.length
      ? supabase
          .from("sources")
          .select("id, title")
          .in("id", [...new Set([...sourceIds, ...jobSources])])
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const codes = new Map((courses ?? []).map((c) => [c.id, c.code]));
  const titles = new Map((sources ?? []).map((s) => [s.id, s.title]));
  const runStats = new Map<string, { n: number; last: number | null }>();
  for (const r of runs ?? []) {
    if (!r.lab_id) continue;
    const s = runStats.get(r.lab_id);
    const err = (r.result as { errorPct?: unknown } | null)?.errorPct;
    if (s) s.n++;
    else runStats.set(r.lab_id, { n: 1, last: typeof err === "number" ? err : null });
  }

  const seen = new Set<string>();
  const labs: LabRow[] = [];
  for (const r of rows ?? []) {
    const l = r.labs;
    if (!l || seen.has(`${l.id}:${r.course_id}`)) continue;
    seen.add(`${l.id}:${r.course_id}`);
    labs.push({
      id: l.id,
      title: l.title,
      origin: l.origin === "manual" ? "manual" : "topic",
      status: l.status === "ready" ? "ready" : "declined",
      reason: l.decline_reason,
      courseId: r.course_id,
      courseCode: r.course_id ? (codes.get(r.course_id) ?? null) : null,
      sourceTitle: l.source_id ? (titles.get(l.source_id) ?? null) : null,
      runs: runStats.get(l.id)?.n ?? 0,
      lastErrorPct: runStats.get(l.id)?.last ?? null,
    });
  }

  const requests: LabRequest[] = [];
  for (const j of jobs ?? []) {
    const p = j.payload as { mode?: string; topic?: string; source_id?: string; course_id?: string | null };
    if (courseId && p.course_id !== courseId) continue;
    const label =
      p.mode === "topic" ? (p.topic ?? "A lab") : `Labs from ${titles.get(p.source_id ?? "") ?? "your manual"}`;
    const base = { jobId: j.id, label, courseId: p.course_id ?? null };
    if (j.status === "queued" || j.status === "running") requests.push({ ...base, status: "building", reason: null });
    else if (j.status === "failed") requests.push({ ...base, status: "failed", reason: j.error });
    else if (p.mode === "topic") {
      const result = j.result as { labs?: unknown[]; declined?: { reason?: string }[] } | null;
      if (!result?.labs?.length)
        requests.push({ ...base, status: "declined", reason: result?.declined?.[0]?.reason ?? null });
    }
  }
  return { labs, requests };
}

export const requestLabBody = z.object({
  topic: z.string().trim().min(3, "Name the practical, like “Hooke's law”.").max(120),
  course_id: z.string().uuid().nullable(),
});

/**
 * "Request a lab": a practical already built by anyone is added at once (shared, no AI call);
 * otherwise lab_extract builds it in the background.
 */
export async function requestLab(
  viewer: Viewer,
  body: z.infer<typeof requestLabBody>,
): Promise<{ status: "added"; labId: string } | { status: "building"; jobId: string }> {
  if (body.course_id) await requireMember(viewer, body.course_id);
  const key = topicKey(body.topic);
  if (key.length < 3) throw new RouteError(422, "Name the practical, like “Hooke's law”.", "invalid_input");
  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("labs")
    .select("id, status")
    .is("owner_id", null)
    .eq("origin", "topic")
    .eq("topic_key", key)
    .maybeSingle();
  if (cached?.status === "ready") {
    const { error } = await admin
      .from("user_labs")
      .insert({ user_id: viewer.userId, lab_id: cached.id, course_id: body.course_id });
    if (error && error.code !== "23505") throw new Error("Couldn't add the lab");
    return { status: "added", labId: cached.id };
  }
  const { data, error } = await admin.rpc("enqueue_job_once", {
    p_queue: "lab_extract",
    p_payload: { mode: "topic", topic: body.topic, course_id: body.course_id, user_id: viewer.userId },
    p_dedupe: `lab:${viewer.userId}:${key}`,
    p_owner: viewer.userId,
  });
  if (error || !data?.[0]) throw new Error("Couldn't queue the lab");
  return { status: "building", jobId: data[0].job_id };
}

/** A lab the student may open: in their list, or a shared one. Server-side config included. */
async function loadLab(viewer: Viewer, labId: string) {
  const admin = createAdminClient();
  const { data: lab } = await admin
    .from("labs")
    .select("id, owner_id, origin, title, status, config, public_config, config_hash, source_id")
    .eq("id", labId)
    .maybeSingle();
  if (!lab || lab.status !== "ready" || (lab.owner_id && lab.owner_id !== viewer.userId))
    throw new RouteError(404, "This lab isn't available. Request it again from Practice.", "not_found");
  const config = experimentConfig.parse(lab.config);
  return { lab, compiled: compileExperiment(config) };
}

export type LabPage = {
  id: string;
  title: string;
  origin: "manual" | "topic";
  sourceTitle: string | null;
  courseId: string | null;
  experiment: PublicExperiment;
};

export async function getLabPage(viewer: Viewer, labId: string): Promise<LabPage> {
  const { lab } = await loadLab(viewer, labId);
  const supabase = await createClient();
  const [{ data: link }, { data: source }] = await Promise.all([
    supabase.from("user_labs").select("course_id").eq("user_id", viewer.userId).eq("lab_id", labId).limit(1),
    lab.source_id
      ? supabase.from("sources").select("title").eq("id", lab.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    id: lab.id,
    title: lab.title,
    origin: lab.origin === "manual" ? "manual" : "topic",
    sourceTitle: source?.title ?? null,
    courseId: link?.[0]?.course_id ?? null,
    experiment: lab.public_config as unknown as PublicExperiment,
  };
}

/** A new run: a fresh seed and every reading the apparatus can give for it. */
export async function startRun(viewer: Viewer, labId: string): Promise<{ seed: number; settings: SettingReadings[] }> {
  const { compiled } = await loadLab(viewer, labId);
  const seed = Math.floor(Math.random() * 2_000_000_000) + 1;
  return { seed, settings: readingsFor(compiled, seed) };
}

export const compareBody = z.object({
  run_id: z.string().uuid(),
  seed: z.number().int().min(1).max(2_147_483_647),
  /** The settings the student took, and how many of each setting's readings. */
  taken: z
    .array(z.object({ value: z.number().finite(), count: z.number().int().min(1).max(5) }))
    .min(2)
    .max(40),
  stated: z.number().finite(),
});

/**
 * The student's result against the accepted value. The readings are regenerated here from the
 * seed, so a run can't be faked from the browser; the run is saved once per client run id.
 */
export async function compareLab(
  viewer: Viewer,
  labId: string,
  body: z.infer<typeof compareBody>,
): Promise<LabComparison> {
  const { lab, compiled } = await loadLab(viewer, labId);
  const all = readingsFor(compiled, body.seed);
  const taken: SettingReadings[] = [];
  for (const t of body.taken) {
    const s = all.find((x) => Math.abs(x.value - t.value) < 1e-9);
    if (!s) throw new RouteError(422, "Those readings don't match this lab. Start a new run.", "invalid_input");
    if (!taken.some((x) => x.value === s.value)) taken.push({ value: s.value, readings: s.readings.slice(0, t.count) });
  }
  const comparison = compareRun(compiled, taken, body.stated);
  const { error } = await createAdminClient()
    .from("lab_runs")
    .insert({
      id: body.run_id,
      user_id: viewer.userId,
      lab_slug: "experiment",
      lab_id: lab.id,
      config_hash: lab.config_hash,
      seed: body.seed,
      data: { taken } as unknown as Json,
      result: comparison as unknown as Json,
      score: Math.max(0, 100 - comparison.errorPct),
    });
  // 23505: the same run compared again (a retry); the first save stands.
  if (error && error.code !== "23505") throw new Error("Couldn't save the run");
  return comparison;
}
