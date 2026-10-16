"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";
import { createClient } from "@/lib/supabase/client";

// Watching a background job (02 §4): Supabase Realtime on the `jobs` row (RLS: owner only), with
// polling every 3 s whenever the subscription isn't live. Stops once the job is done or failed.

const jobStatus = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "done", "failed"]),
  updated_at: z.string(),
});
export type JobStatus = z.infer<typeof jobStatus>;

const POLL_MS = 3000;
const finished = (s?: JobStatus["status"]) => s === "done" || s === "failed";

export function useJob(jobId: string | null, options: { onSettled?: (job: JobStatus) => void } = {}) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const onSettled = useRef(options.onSettled);
  useEffect(() => {
    onSettled.current = options.onSettled;
  });

  const key = queryKeys.jobs.detail(jobId ?? "none");
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch(`/api/jobs/${jobId}`, { schema: jobStatus, signal }),
    enabled: Boolean(jobId),
    // Someone else's job (a student who joined it) isn't readable: don't keep asking.
    retry: false,
    refetchInterval: (q) => (live || finished(q.state.data?.status) || q.state.error ? false : POLL_MS),
  });

  useEffect(() => {
    if (!jobId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`job:${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, (msg) => {
        const parsed = jobStatus.safeParse(msg.new);
        if (parsed.success) queryClient.setQueryData(queryKeys.jobs.detail(jobId), parsed.data);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  const data = query.data;
  useEffect(() => {
    if (data && finished(data.status)) onSettled.current?.(data);
  }, [data]);

  return query;
}
