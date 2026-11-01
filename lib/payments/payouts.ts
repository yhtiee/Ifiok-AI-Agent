import "server-only";
import { z } from "zod";
import { lagosDay } from "@ifiok/core";
import type { PayoutExplainOutput } from "@ifiok/core/ai/skills/payouts";
import { GatewayError } from "@ifiok/core/ai/gateway";
import { getGateway } from "@/lib/ai";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usd } from "./money";
import { getPaypal } from "./paypal";
import { payTutorsWaitingFor } from "./tutoring";

// Contributor payouts in the PayPal sandbox (10 MVP-07, 06 §3, §15): the student's PayPal email,
// the admin's monthly close (a sandbox-funded pool split by usage points, 20% cap per person, all in
// SQL), the payout batch, and each line explained in plain words. Webhooks mark lines paid
// (lib/payments/webhook.ts). Money changes only through the SQL functions (guardrail 5).

export const payoutAccountBody = z.object({
  paypal_email: z.email("Enter the email of your PayPal sandbox account.").max(254),
});

export async function savePayoutAccount(viewer: Viewer, email: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("payout_accounts")
    .upsert({ user_id: viewer.userId, paypal_email: email.trim().toLowerCase(), updated_at: new Date().toISOString() });
  if (error) throw new RouteError(503, "Ifiok couldn't save your PayPal email. Try again.", "save_failed");
  // Tutoring sessions already released to this tutor are paid now that there's somewhere to send them.
  await payTutorsWaitingFor(viewer.userId).catch(() => {});
}

export async function removePayoutAccount(viewer: Viewer) {
  await createAdminClient().from("payout_accounts").delete().eq("user_id", viewer.userId);
}

export type PayoutLineView = {
  id: string;
  month: string;
  points: number;
  amountCents: number;
  capped: boolean;
  status: string;
  explanation: string | null;
};

export async function myPayouts(viewer: Viewer): Promise<{ email: string | null; lines: PayoutLineView[] }> {
  const supabase = await createClient();
  const [{ data: account }, { data: lines }] = await Promise.all([
    supabase.from("payout_accounts").select("paypal_email").eq("user_id", viewer.userId).maybeSingle(),
    supabase
      .from("payout_lines")
      .select("id, points, amount_cents, capped, status, explanation, payout_periods(month)")
      .eq("user_id", viewer.userId)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);
  return {
    email: account?.paypal_email ?? null,
    lines: (lines ?? []).map((l) => ({
      id: l.id,
      month: l.payout_periods?.month ?? "",
      points: l.points,
      amountCents: Number(l.amount_cents),
      capped: l.capped,
      status: l.status,
      explanation: l.explanation,
    })),
  };
}

// ---------------------------------------------------------------------------
// Admin: close a month, send its payouts.
// ---------------------------------------------------------------------------

export const closeMonthBody = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month."),
  pool_cents: z.number().int().min(0).max(1_000_000),
});

export async function closeMonth(month: string, poolCents: number): Promise<string> {
  const { data, error } = await createAdminClient().rpc("compute_period", {
    p_month: `${month}-01`,
    p_pool_cents: poolCents,
  });
  if (error || !data) throw new RouteError(503, "Ifiok couldn't close the month. Try again.", "close_failed");
  return data;
}

export async function sendPayouts(periodId: string): Promise<{ sent: number; waiting: number }> {
  const admin = createAdminClient();
  const { data: period } = await admin
    .from("payout_periods")
    .select("id, month, status, attempt")
    .eq("id", periodId)
    .maybeSingle();
  if (!period) throw new RouteError(404, "That month isn't closed yet.", "not_found");
  if (period.status === "sent") throw new RouteError(409, "This month's payouts were already sent.", "already_sent");
  const { data: lines, error } = await admin.rpc("prepare_payout", { p_period: periodId });
  if (error) throw new RouteError(503, "Ifiok couldn't prepare the payouts. Try again.", "prepare_failed");
  const { count: waiting } = await admin
    .from("payout_lines")
    .select("id", { count: "exact", head: true })
    .eq("period_id", periodId)
    .eq("status", "no_account");
  if (!lines?.length) return { sent: 0, waiting: waiting ?? 0 };

  const label = new Date(`${period.month}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  // One sender batch id per attempt: a retry after a denied batch is a new batch (PayPal dedupes ids).
  const { batchId } = await getPaypal().createPayout(
    period.attempt > 1 ? `period-${periodId}-${period.attempt}` : `period-${periodId}`,
    `Your Ifiok earnings for ${label} (sandbox)`,
    [
      ...lines.map((l) => ({
        receiver: l.receiver,
        amountCents: Number(l.amount_cents),
        senderItemId: `line:${l.line_id}`,
        note: `Your share of Ifiok's contribution pool for ${label}. Sandbox: test money.`,
      })),
    ],
  );
  const { data: sent, error: markError } = await admin.rpc("mark_period_sent", {
    p_period: periodId,
    p_batch_id: batchId,
  });
  if (markError) throw new RouteError(503, "PayPal took the batch but Ifiok couldn't record it.", "mark_failed");
  return { sent: sent ?? 0, waiting: waiting ?? 0 };
}

/**
 * Reads each sent item's status from PayPal and records it (the same SQL the webhook uses), for when
 * a webhook is late or can't reach this deployment. Idempotent.
 */
export async function refreshPeriod(periodId: string): Promise<{ changed: number }> {
  const admin = createAdminClient();
  const { data: period } = await admin
    .from("payout_periods")
    .select("paypal_batch_id")
    .eq("id", periodId)
    .maybeSingle();
  if (!period?.paypal_batch_id) return { changed: 0 };
  const { items } = await getPaypal().getPayoutBatch(period.paypal_batch_id);
  let changed = 0;
  for (const item of items) {
    const [kind, id] = (item.payout_item.sender_item_id ?? "").split(":");
    if (kind !== "line" || !id) continue;
    const { data } = await admin.rpc("record_payout_item", {
      p_line: id,
      p_item_id: item.payout_item_id,
      p_paypal_status: item.transaction_status ?? "PENDING",
    });
    if (data) changed++;
  }
  return { changed };
}

/** Failed, returned or unclaimed lines go back to pending, so the month can be sent again. */
export async function retryFailed(periodId: string): Promise<{ reopened: number }> {
  const { data, error } = await createAdminClient().rpc("reopen_failed_payouts", { p_period: periodId });
  if (error) throw new RouteError(503, "Ifiok couldn't reopen the failed payouts. Try again.", "reopen_failed");
  return { reopened: data ?? 0 };
}

export type AdminPeriod = {
  id: string;
  month: string;
  poolCents: number;
  splitCents: number;
  carriedCents: number;
  totalPoints: number;
  status: string;
  attempt: number;
  lines: { id: string; name: string; points: number; amountCents: number; capped: boolean; status: string }[];
};

export async function adminPayouts(): Promise<{ periods: AdminPeriod[]; demoPoolCents: number; month: string }> {
  const admin = createAdminClient();
  const [{ data: periods }, cfg] = await Promise.all([
    admin
      .from("payout_periods")
      .select(
        "id, month, pool_cents, split_cents, carried_cents, total_points, status, attempt, payout_lines(id, user_id, points, amount_cents, capped, status)",
      )
      .order("month", { ascending: false })
      .limit(6),
    getConfig("payouts"),
  ]);
  const people = [...new Set((periods ?? []).flatMap((p) => p.payout_lines.map((l) => l.user_id)))];
  const { data: names } = people.length
    ? await admin.from("profiles").select("id, display_name").in("id", people)
    : { data: [] as { id: string; display_name: string | null }[] };
  const name = new Map((names ?? []).map((n) => [n.id, n.display_name ?? "A student"]));
  return {
    demoPoolCents: cfg.demo_pool_cents,
    month: lagosDay().slice(0, 7),
    periods: (periods ?? []).map((p) => ({
      id: p.id,
      month: p.month,
      poolCents: Number(p.pool_cents),
      splitCents: Number(p.split_cents),
      carriedCents: Number(p.carried_cents),
      totalPoints: p.total_points,
      status: p.status,
      attempt: p.attempt,
      lines: p.payout_lines
        .map((l) => ({
          id: l.id,
          name: name.get(l.user_id) ?? "A student",
          points: l.points,
          amountCents: Number(l.amount_cents),
          capped: l.capped,
          status: l.status,
        }))
        .sort((a, b) => b.amountCents - a.amountCents),
    })),
  };
}

// ---------------------------------------------------------------------------
// "Why this amount": the AI explains a line from the recorded numbers (10 MVP-07).
// ---------------------------------------------------------------------------

const KIND_WORDS: Record<string, string> = {
  notes: "notes",
  textbook_private: "textbook",
  past_paper: "past questions",
  lab_manual: "lab manual",
  solution: "worked solutions",
  explainer: "explainer",
};

/** Every number in the text must be one of the numbers given (guardrail 2). */
export function numbersAllowed(text: string, allowed: string[]): boolean {
  const ok = new Set(allowed.map((a) => a.replace(/[$,]/g, "")));
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).every((n) => ok.has(n.replace(/,/g, "")));
}

export function plainExplanation(input: {
  month: string;
  points: number;
  sources: { title: string; kind: string; points: number }[];
  pool: string;
  total_points: number;
  amount: string;
  capped: boolean;
}): string {
  const parts = input.sources.map((s) => `${s.points} from your ${KIND_WORDS[s.kind] ?? s.kind} "${s.title}"`);
  return [
    `You earned ${input.points} ${input.points === 1 ? "point" : "points"} in ${input.month}${parts.length ? `: ${parts.join(", ")}` : ""}.`,
    `The pool was ${input.pool}, shared across ${input.total_points} points from every contributor, so your share is ${input.amount}.`,
    input.capped ? "No one gets more than 20% of a month's pool, so your share stops there." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function explainLine(viewer: Viewer, lineId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: line } = await admin
    .from("payout_lines")
    .select("id, user_id, points, amount_cents, capped, explanation, payout_periods(month, pool_cents, total_points)")
    .eq("id", lineId)
    .maybeSingle();
  if (!line || line.user_id !== viewer.userId || !line.payout_periods)
    throw new RouteError(404, "That payout doesn't exist.", "not_found");
  if (line.explanation) return line.explanation;

  const p = line.payout_periods;
  const { data: points } = await admin
    .from("usage_points")
    .select("resource_kind, resource_id")
    .eq("contributor_id", viewer.userId)
    .eq("month", p.month);
  const counts = new Map<string, { kind: string; n: number }>();
  for (const u of points ?? []) {
    const c = counts.get(u.resource_id) ?? { kind: u.resource_kind, n: 0 };
    counts.set(u.resource_id, { ...c, n: c.n + 1 });
  }
  const ids = [...counts.keys()];
  const [{ data: sources }, { data: explainers }] = await Promise.all([
    admin
      .from("sources")
      .select("id, title, kind")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("explainers")
      .select("id, title")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const title = new Map<string, { title: string; kind: string }>([
    ...(sources ?? []).map((s): [string, { title: string; kind: string }] => [s.id, { title: s.title, kind: s.kind }]),
    ...(explainers ?? []).map((e): [string, { title: string; kind: string }] => [
      e.id,
      { title: e.title, kind: "explainer" },
    ]),
  ]);
  const input = {
    month: new Date(`${p.month}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    points: line.points,
    sources: [...counts]
      .map(([id, c]) => ({
        title: title.get(id)?.title ?? "an item",
        kind: title.get(id)?.kind ?? c.kind,
        points: c.n,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 20),
    pool: usd(Number(p.pool_cents)),
    total_points: p.total_points,
    amount: usd(Number(line.amount_cents)),
    capped: line.capped,
  };
  const allowed = [
    String(input.points),
    String(input.total_points),
    input.pool,
    input.amount,
    "20",
    ...input.sources.map((s) => String(s.points)),
    ...input.month.split(" "),
    ...input.sources.flatMap((s) => s.title.match(/\d+/g) ?? []),
  ];
  let text = plainExplanation(input);
  try {
    const out = (
      await getGateway().run<PayoutExplainOutput>("payout_explain", { userId: viewer.userId, input })
    ).output.text.trim();
    // The model explains; the numbers are ours. Anything else falls back to the plain sentence.
    if (numbersAllowed(out, allowed)) text = out;
  } catch (err) {
    if (!(err instanceof GatewayError)) throw err;
  }
  await admin.rpc("set_payout_explanation", { p_line: lineId, p_text: text });
  return text;
}
