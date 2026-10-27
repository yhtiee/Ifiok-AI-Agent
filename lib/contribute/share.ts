import "server-only";
import { z } from "zod";
import { SHAREABLE_SOURCE_KINDS } from "@ifiok/core/materials/kinds";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

// Share to the library (F11, 10 MVP-06): the student's own material, with the licence attestation,
// goes to the `curate` job, which approves it into the contribution pool or holds or rejects it
// with a reason. Clients never set review or visibility themselves (03 §8).

export const shareBody = z.object({
  attest: z.literal(true, { error: "Confirm the material is yours to share." }),
});

export async function shareMaterial(viewer: Viewer, sourceId: string): Promise<{ jobId: string }> {
  const admin = createAdminClient();
  const { data: source } = await admin
    .from("sources")
    .select("id, owner_id, kind, shared_at, review")
    .eq("id", sourceId)
    .maybeSingle();
  // Someone else's material answers exactly like a missing one.
  if (!source || source.owner_id !== viewer.userId)
    throw new RouteError(404, "Those materials don't exist any more.", "not_found");
  if (!(SHAREABLE_SOURCE_KINDS as readonly string[]).includes(source.kind))
    throw new RouteError(422, "Textbook pages stay private to you; they can't be shared.", "not_shareable");
  if (source.shared_at && source.review === "approved")
    throw new RouteError(409, "This is already in the library.", "already_shared");
  if (source.shared_at && source.review === "pending")
    throw new RouteError(409, "Ifiok is already checking this.", "checking");

  const now = new Date().toISOString();
  const { error } = await admin
    .from("sources")
    .update({ shared_at: now, license_attested_at: now, review: "pending", review_reason: null })
    .eq("id", sourceId)
    .eq("owner_id", viewer.userId);
  if (error) throw new RouteError(503, "Ifiok couldn't share this. Try again in a minute.", "share_failed");
  const { data: job, error: jobError } = await admin.rpc("enqueue_job_once", {
    p_queue: "curate",
    p_payload: { source_id: sourceId, user_id: viewer.userId },
    p_dedupe: `curate:${sourceId}`,
    p_owner: viewer.userId,
  });
  if (jobError || !job?.[0])
    throw new RouteError(503, "Ifiok couldn't share this. Try again in a minute.", "share_failed");
  return { jobId: job[0].job_id };
}
