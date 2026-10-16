import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api/input";
import { RouteError, route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { ENQUEUE_DAILY_LIMIT, checkUserQueue } from "@/lib/jobs/enqueue";
import { createAdminClient } from "@/lib/supabase/admin";

const body = z.object({
  queue: z.string().min(1).max(40),
  payload: z.unknown(),
  dedupe_key: z.string().min(1).max(120).optional(),
});

// POST /api/jobs/enqueue: start a background job (02 §4). User queues only, 30 per day, owner from
// the session; the enqueue trigger wakes the worker.
export const POST = route(async (req: Request) => {
  const viewer = await requireAdult();
  const input = await parseJson(req, body);

  const check = checkUserQueue(input.queue);
  if (!check.ok) throw new RouteError(check.status, check.message, check.code);
  const payload = check.schema.safeParse(input.payload);
  if (!payload.success) {
    throw new RouteError(422, `Check the job details: ${payload.error.issues[0]?.message ?? "invalid"}.`, "invalid");
  }

  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc("consume_quota", {
    p_user: viewer.userId,
    p_feature: "job_enqueue",
    p_limit: ENQUEUE_DAILY_LIMIT,
  });
  if (!allowed) {
    throw new RouteError(
      429,
      `You've started ${ENQUEUE_DAILY_LIMIT} jobs today. Try again tomorrow.`,
      "quota_exhausted",
    );
  }

  // Dedupe keys are scoped to the student, so one student can't block another's job.
  const { data: rows, error } = await admin.rpc("enqueue_job_once", {
    p_queue: check.queue,
    p_payload: payload.data as never,
    p_dedupe: `${viewer.userId}:${check.queue}:${input.dedupe_key ?? crypto.randomUUID()}`,
    p_owner: viewer.userId,
  });
  const job = rows?.[0];
  if (error || !job || !job.created) {
    await admin.rpc("refund_quota", { p_user: viewer.userId, p_feature: "job_enqueue" });
  }
  if (error || !job) throw new RouteError(503, "Ifiok couldn't start that job. Try again in a minute.", "job_failed");

  return NextResponse.json({ jobId: job.job_id, created: job.created }, { status: job.created ? 201 : 200 });
});
