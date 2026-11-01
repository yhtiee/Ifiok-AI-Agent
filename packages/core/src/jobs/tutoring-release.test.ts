import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import type { Paypal } from "../payments/paypal";
import { createTutoringReleaseHandler } from "./tutoring-release";
import { JobFailure, type ClaimedJob } from "./types";

const LEARNER = "00000000-0000-4000-8000-000000000001";
const TUTOR = "00000000-0000-4000-8000-000000000002";
const ID = "00000000-0000-4000-8000-0000000000b1";

// A tiny stand-in for the two tables and the booking_step function the release uses.
function fakeDb(booking: Record<string, unknown>, email: string | null) {
  const steps: string[] = [];
  const db = {
    from(table: string) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () =>
          table === "tutoring_bookings" ? { data: { ...booking } } : { data: email ? { paypal_email: email } : null },
      };
      return q;
    },
    rpc: async (_fn: string, args: { p_to: string; p_ref: string | null }) => {
      steps.push(args.p_to);
      if (args.p_to === "captured") Object.assign(booking, { status: "captured", paypal_capture_id: args.p_ref });
      if (args.p_to === "paid_out") Object.assign(booking, { status: "paid_out" });
      return { data: true, error: null };
    },
  };
  return { db: db as unknown as SupabaseClient<Database>, steps };
}

const booking = (over: Record<string, unknown> = {}) => ({
  id: ID,
  learner_id: LEARNER,
  tutor_id: TUTOR,
  status: "authorized",
  starts_at: "2026-11-01T17:00:00Z",
  minutes: 45,
  price_cents: 1000,
  take_rate_bp: 1500,
  paypal_authorization_id: "AUTH-1",
  ...over,
});
const job = (ownerId = LEARNER): ClaimedJob => ({
  queue: "tutoring_release",
  msgId: 1,
  jobId: "j",
  attempts: 1,
  ownerId,
  payload: { booking_id: ID },
});
const paypal = () => {
  const p = {
    captureAuthorization: vi.fn(async () => ({ id: "CAP-1", status: "COMPLETED" })),
    createPayout: vi.fn(async () => ({ batchId: "B-1", status: "PENDING" })),
  };
  return p;
};

describe("tutoring_release (F17-FR4)", () => {
  it("waits until 24 h after the session ends", async () => {
    const { db } = fakeDb(booking(), "t@x.com");
    const p = paypal();
    const out = await createTutoringReleaseHandler({
      db,
      paypal: () => p as unknown as Paypal,
      autoReleaseHours: async () => 24,
      now: () => new Date("2026-11-02T17:00:00Z"),
    }).run(job());
    expect(out).toMatchObject({ kind: "defer", seconds: 45 * 60 });
    expect(p.captureAuthorization).not.toHaveBeenCalled();
  });

  it("then captures and pays the tutor their share, keyed on the booking", async () => {
    const { db, steps } = fakeDb(booking(), "t@x.com");
    const p = paypal();
    const out = await createTutoringReleaseHandler({
      db,
      paypal: () => p as unknown as Paypal,
      autoReleaseHours: async () => 24,
      now: () => new Date("2026-11-03T00:00:00Z"),
    }).run(job());
    expect(out).toMatchObject({ kind: "done", result: { released: "paid_out" } });
    expect(steps).toEqual(["captured", "paid_out"]);
    expect(p.createPayout).toHaveBeenCalledWith(`booking-${ID}`, expect.any(String), [
      expect.objectContaining({ receiver: "t@x.com", amountCents: 850, senderItemId: `booking:${ID}` }),
    ]);
  });

  it("does nothing once the learner confirmed, voided or disputed it", async () => {
    const { db } = fakeDb(booking({ status: "disputed" }), "t@x.com");
    const p = paypal();
    const out = await createTutoringReleaseHandler({
      db,
      paypal: () => p as unknown as Paypal,
      autoReleaseHours: async () => 24,
    }).run(job());
    expect(out).toMatchObject({ kind: "done", result: { skipped: "disputed" } });
    expect(p.captureAuthorization).not.toHaveBeenCalled();
  });

  it("refuses a job whose owner isn't the learner (guardrail 7)", async () => {
    const { db } = fakeDb(booking(), null);
    await expect(
      createTutoringReleaseHandler({
        db,
        paypal: () => paypal() as unknown as Paypal,
        autoReleaseHours: async () => 24,
      }).run(job(TUTOR)),
    ).rejects.toBeInstanceOf(JobFailure);
  });
});
