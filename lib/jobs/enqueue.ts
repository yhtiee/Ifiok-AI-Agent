import { z } from "zod";

// Which jobs a student may start directly (02 §4): only user queues, never system queues such as
// payouts, curate or notify. Each user queue gets its payload schema with its ticket; until then it
// answers "not available yet". Owner ids always come from the session, never the payload.

export const ENQUEUE_DAILY_LIMIT = 30;

export const USER_QUEUES = {
  mark_transcribe: null, // P1-10 snap-and-mark
  ocr: null, // F3 private textbooks (P1b)
  lesson_gen: null, // private lessons from a student's own textbook (F3); shared lessons use /api/concepts/:id/lesson
} as const satisfies Record<string, z.ZodType | null>;

export type UserQueue = keyof typeof USER_QUEUES;

export type QueueCheck =
  { ok: true; queue: UserQueue; schema: z.ZodType } | { ok: false; status: 403 | 422; message: string; code: string };

export function checkUserQueue(queue: string): QueueCheck {
  if (!Object.hasOwn(USER_QUEUES, queue)) {
    return { ok: false, status: 403, message: "You can't start that kind of job.", code: "queue_not_allowed" };
  }
  const schema = USER_QUEUES[queue as UserQueue] as z.ZodType | null;
  if (!schema) {
    return { ok: false, status: 422, message: "That feature isn't available yet.", code: "queue_not_open" };
  }
  return { ok: true, queue: queue as UserQueue, schema };
}
