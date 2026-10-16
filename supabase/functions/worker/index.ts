// The job worker (specifications/02-architecture.md §4). Woken by the enqueue trigger (pg_net) and
// the pg_cron sweeper every minute; both send the shared INTERNAL_FUNCTION_SECRET. It answers at
// once and drains the queues in the background (EdgeRuntime.waitUntil) within a 130 s deadline.
// All job logic lives in packages/core (copied to ../_shared/core by `pnpm sync:core`).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { createConfigReader } from "../_shared/core/ai/config.ts";
import { createGateway } from "../_shared/core/ai/gateway.ts";
import { createGeminiProvider } from "../_shared/core/ai/providers/gemini.ts";
import { createGroqProvider } from "../_shared/core/ai/providers/groq.ts";
import { createSupabaseGatewayStore } from "../_shared/core/ai/store.ts";
import type { Database } from "../_shared/core/db/types.ts";
import { createLessonGenHandler } from "../_shared/core/jobs/lesson-gen.ts";
import { noopHandler } from "../_shared/core/jobs/noop.ts";
import { runWorker } from "../_shared/core/jobs/runner.ts";
import { createSupabaseWorkerQueue } from "../_shared/core/jobs/supabase-queue.ts";
import { QUEUES, type QueueName } from "../_shared/core/jobs/types.ts";
import { createSupabaseLessonRepo } from "../_shared/core/lessons/repo.ts";

// Provided by the Supabase Edge Runtime: keeps the invocation alive for background work.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** The service-role key: the legacy JWT, or the first new-style secret key. */
function serviceKey(): string | undefined {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return undefined;
  }
}

function buildWorker() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!url || !key) throw new Error("SUPABASE_URL and a service-role key are required");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const gateway = createGateway({
    config: createConfigReader(db),
    providers: {
      gemini: createGeminiProvider(Deno.env.get("GEMINI_API_KEY")),
      groq: createGroqProvider(Deno.env.get("GROQ_API_KEY")),
    },
    store: createSupabaseGatewayStore(db),
    // Metadata only, never prompts or outputs (guardrail 10).
    log: (event) => {
      if (event.type !== "redacted") console.warn("[ai]", JSON.stringify(event));
    },
  });

  return {
    queue: createSupabaseWorkerQueue(db),
    handlers: {
      noop: noopHandler,
      lesson_gen: createLessonGenHandler({ repo: createSupabaseLessonRepo(db), gateway }),
    },
  };
}

let worker: ReturnType<typeof buildWorker> | null = null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!secret || req.headers.get("x-ifiok-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let only: QueueName[] | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { queue?: unknown };
    if (typeof body.queue === "string" && (QUEUES as readonly string[]).includes(body.queue)) {
      only = [body.queue as QueueName];
    }
  } catch {
    // An empty body means "every queue" (the sweeper).
  }

  worker ??= buildWorker();
  const { queue, handlers } = worker;
  EdgeRuntime.waitUntil(
    runWorker({
      queue,
      handlers,
      only,
      log: (event) => console.log("[worker]", JSON.stringify(event)),
    }).catch((err) => console.error("[worker] run failed", err instanceof Error ? err.message : "unknown")),
  );
  return json({ accepted: true, queues: only ?? "all" }, 202);
});
