import {
  DEFAULT_FAILURE_MESSAGE,
  HEAVY_JOB_BUDGET_MS,
  HEAVY_QUEUES,
  JobFailure,
  LIGHT_BATCH,
  MAX_ATTEMPTS,
  QUEUES,
  RETRY_BACKOFF_S,
  VISIBILITY_TIMEOUT_S,
  WORKER_DEADLINE_MS,
  type ClaimedJob,
  type JobHandler,
  type QueueName,
  type WorkerQueue,
} from "./types";

// One worker invocation (02 §4): drain the queues that have handlers until the deadline. Heavy
// queues take one message per invocation; light queues take batches of up to 5 while time lasts.

export type WorkerEvent =
  | { type: "done"; queue: QueueName; jobId: string; ms: number }
  | { type: "deferred"; queue: QueueName; jobId: string; seconds: number }
  | { type: "retry"; queue: QueueName; jobId: string; attempts: number; reason: string }
  | { type: "failed"; queue: QueueName; jobId: string; attempts: number; reason: string };

export type RunWorkerOptions = {
  queue: WorkerQueue;
  handlers: Partial<Record<QueueName, JobHandler>>;
  /** Only these queues (e.g. the one an enqueue trigger named); default: every queue with a handler. */
  only?: QueueName[];
  deadlineMs?: number;
  now?: () => number;
  /** Metadata only: never payloads, prompts or outputs (guardrail 10). */
  log?: (event: WorkerEvent) => void;
};

export type RunWorkerResult = { processed: number; byQueue: Partial<Record<QueueName, number>> };

function reasonOf(err: unknown): string {
  if (err instanceof JobFailure) return err.message;
  if (err instanceof Error) return err.name;
  return "unknown";
}

export async function runWorker(options: RunWorkerOptions): Promise<RunWorkerResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const deadline = started + (options.deadlineMs ?? WORKER_DEADLINE_MS);
  const log = options.log ?? (() => {});
  const queues = QUEUES.filter((q) => options.handlers[q] && (!options.only || options.only.includes(q)));
  const result: RunWorkerResult = { processed: 0, byQueue: {} };

  const process = async (handler: JobHandler, job: ClaimedJob) => {
    const t0 = now();
    // A message that keeps crashing the runtime never reaches the catch below; stop it here.
    if (job.attempts > MAX_ATTEMPTS) {
      await options.queue.fail(job, DEFAULT_FAILURE_MESSAGE, true, 0);
      await handler.giveUp?.(job);
      log({ type: "failed", queue: job.queue, jobId: job.jobId, attempts: job.attempts, reason: "too_many_attempts" });
      return;
    }
    try {
      const outcome = await handler.run(job);
      if (outcome.kind === "defer") {
        await options.queue.defer(job, outcome.seconds, outcome.result);
        log({ type: "deferred", queue: job.queue, jobId: job.jobId, seconds: outcome.seconds });
      } else {
        await options.queue.complete(job, outcome.result);
        log({ type: "done", queue: job.queue, jobId: job.jobId, ms: now() - t0 });
      }
    } catch (err) {
      const final = job.attempts >= MAX_ATTEMPTS || (err instanceof JobFailure && !err.retryable);
      const message = err instanceof JobFailure ? err.userMessage : DEFAULT_FAILURE_MESSAGE;
      await options.queue.fail(job, message, final, RETRY_BACKOFF_S);
      if (final) await handler.giveUp?.(job);
      log({
        type: final ? "failed" : "retry",
        queue: job.queue,
        jobId: job.jobId,
        attempts: job.attempts,
        reason: reasonOf(err),
      });
    }
    result.processed++;
    result.byQueue[job.queue] = (result.byQueue[job.queue] ?? 0) + 1;
  };

  for (const queue of queues) {
    const handler = options.handlers[queue]!;
    if (HEAVY_QUEUES.has(queue)) {
      if (deadline - now() < HEAVY_JOB_BUDGET_MS) continue;
      const [job] = await options.queue.read(queue, VISIBILITY_TIMEOUT_S, 1);
      if (job) await process(handler, job);
      continue;
    }
    while (deadline - now() > 10_000) {
      const batch = await options.queue.read(queue, VISIBILITY_TIMEOUT_S, LIGHT_BATCH);
      if (batch.length === 0) break;
      for (const job of batch) await process(handler, job);
    }
  }
  return result;
}
