import { NextResponse } from "next/server";
import { RouteError, route } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/jobs/:id: a job's progress for its owner (RLS). Only the status is returned; check
// details stay server-side for curators. P0-11 replaces polling with Realtime (`useJob`).
export const GET = route(async (_req: Request, { params }: Params) => {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: job, error } = await supabase.from("jobs").select("id, status, updated_at").eq("id", id).maybeSingle();
  if (error || !job) throw new RouteError(404, "That job doesn't exist.", "job_not_found");

  return NextResponse.json({ id: job.id, status: job.status, updated_at: job.updated_at });
});
