import "server-only";
import { z } from "zod";
import { GatewayError } from "@ifiok/core/ai/gateway";
import type { TutorAgentOutput } from "@ifiok/core/ai/skills/tutoring";
import { getGateway } from "@/lib/ai";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { getWeakAreas } from "@/lib/learning/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAgentInput, checkDecision, rulesPick, slotToDate, type TutorOffer, type WeakTopic } from "./agent-rules";
import { usd } from "./money";

// Ifiok's tutoring agent (12 §4 Q63, 10 MVP-07 agentic commerce). On the student's request it
// looks at their weak topics (from server-written answers), the tutors who teach them and cost no
// more than the student's own spending limit, and the sessions already booked; the AI picks the
// topic, tutor and time and says why; the server checks every part of that answer (or the rules
// pick) and stores the draft. Nothing is booked or paid until the student approves it on PayPal.

const DAY_MS = 24 * 3600 * 1000;

export async function spendLimitCents(viewer: Viewer): Promise<number> {
  const [{ data }, cfg] = await Promise.all([
    (await createClient())
      .from("tutoring_preferences")
      .select("spend_limit_cents")
      .eq("user_id", viewer.userId)
      .maybeSingle(),
    getConfig("tutor_agent"),
  ]);
  return data?.spend_limit_cents ?? cfg.default_limit_cents;
}

export const limitBody = z.object({ spend_limit_cents: z.number().int() });

export async function setSpendLimit(viewer: Viewer, cents: number) {
  const band = await getConfig("tutoring");
  if (cents < band.price_min_cents || cents > band.price_max_cents)
    throw new RouteError(
      422,
      `Set a limit between ${usd(band.price_min_cents)} and ${usd(band.price_max_cents)}.`,
      "limit_band",
    );
  const { error } = await createAdminClient()
    .from("tutoring_preferences")
    .upsert({ user_id: viewer.userId, spend_limit_cents: cents, updated_at: new Date().toISOString() });
  if (error) throw new RouteError(503, "Ifiok couldn't save your limit. Try again.", "save_failed");
}

export type AgentProposal = {
  id: string;
  concept: { id: string; title: string };
  tutor: { id: string; name: string };
  startsAt: string;
  price: string;
  limit: string;
  reason: string;
  considered: { weakTopics: number; tutors: number; overLimit: number };
  decidedBy: "ai" | "rules";
};

async function toView(row: {
  id: string;
  concept_id: string;
  tutor_id: string;
  starts_at: string;
  price_cents: number;
  spend_limit_cents: number;
  reason: string;
  considered: unknown;
  decided_by: string;
}): Promise<AgentProposal> {
  const admin = createAdminClient();
  const [{ data: concept }, { data: tutor }] = await Promise.all([
    admin.from("concepts").select("title").eq("id", row.concept_id).maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", row.tutor_id).maybeSingle(),
  ]);
  const c = (row.considered ?? {}) as Partial<AgentProposal["considered"]>;
  return {
    id: row.id,
    concept: { id: row.concept_id, title: concept?.title ?? "Topic" },
    tutor: { id: row.tutor_id, name: tutor?.display_name ?? "A student" },
    startsAt: row.starts_at,
    price: usd(row.price_cents),
    limit: usd(row.spend_limit_cents),
    reason: row.reason,
    considered: { weakTopics: c.weakTopics ?? 0, tutors: c.tutors ?? 0, overLimit: c.overLimit ?? 0 },
    decidedBy: row.decided_by === "ai" ? "ai" : "rules",
  };
}

/** The student's open proposal from the last week, if any. */
export async function openProposal(viewer: Viewer): Promise<AgentProposal | null> {
  const { data } = await (
    await createClient()
  )
    .from("agent_proposals")
    .select("*")
    .eq("user_id", viewer.userId)
    .eq("status", "proposed")
    .gte("created_at", new Date(Date.now() - 7 * DAY_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data && new Date(data.starts_at).getTime() > Date.now() ? toView(data) : null;
}

/** One proposal of the viewer's, for the booking page (only while it's open). */
export async function proposalFor(viewer: Viewer, id: string): Promise<AgentProposal | null> {
  const { data } = await (
    await createClient()
  )
    .from("agent_proposals")
    .select("*")
    .eq("user_id", viewer.userId)
    .eq("id", id)
    .eq("status", "proposed")
    .maybeSingle();
  return data ? toView(data) : null;
}

export async function dismissProposal(viewer: Viewer, id: string) {
  await createAdminClient()
    .from("agent_proposals")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .eq("status", "proposed");
}

/** Runs the agent for the viewer and stores its draft. */
export async function runTutorAgent(viewer: Viewer): Promise<AgentProposal> {
  const admin = createAdminClient();
  const [cfg, limitCents] = await Promise.all([getConfig("tutor_agent"), spendLimitCents(viewer)]);
  const weakAreas = await getWeakAreas(viewer, cfg.max_weak_topics);
  if (!weakAreas.length)
    throw new RouteError(
      409,
      "Ifiok hasn't seen a topic you're stuck on yet. Practise first, then ask again.",
      "no_weak_topics",
    );
  const weak: WeakTopic[] = weakAreas.map((w) => ({
    conceptId: w.conceptId,
    title: w.title,
    evidence: w.evidence,
    mistake: w.mistake?.title ?? null,
    m: w.m,
  }));

  const { data: offers } = await admin
    .from("tutor_concepts")
    .select("user_id, concept_id, tutor_profiles!inner(active, price_cents, availability)")
    .in(
      "concept_id",
      weak.map((w) => w.conceptId),
    )
    .eq("tutor_profiles.active", true)
    .not("tutor_profiles.price_cents", "is", null)
    .neq("user_id", viewer.userId);
  const priced = (offers ?? []).filter((o) => o.tutor_profiles.price_cents);
  const within = priced.filter((o) => o.tutor_profiles.price_cents! <= limitCents);
  const overLimit = priced.length - within.length;
  if (!within.length)
    throw new RouteError(
      409,
      overLimit
        ? `The tutors for your weak topics cost more than your ${usd(limitCents)} limit. Raise your limit to see them.`
        : "No one tutors your weak topics yet. Try the student explainers for them.",
      "no_tutors",
    );

  const ids = [...new Set(within.map((o) => o.user_id))];
  const [{ data: mastery }, { data: paid }, { data: names }, { data: booked }] = await Promise.all([
    admin.from("mastery").select("user_id, concept_id, level").in("user_id", ids),
    admin.from("tutoring_bookings").select("tutor_id").eq("status", "paid_out").in("tutor_id", ids),
    admin.from("profiles").select("id, display_name").in("id", ids),
    admin
      .from("tutoring_bookings")
      .select("concept_id")
      .eq("learner_id", viewer.userId)
      // Held sessions only: a booking never approved on PayPal doesn't block the topic.
      .eq("status", "authorized"),
  ]);
  const tutorOffers: TutorOffer[] = within.slice(0, cfg.max_tutors).map((o) => {
    const level = mastery?.find((m) => m.user_id === o.user_id && m.concept_id === o.concept_id)?.level;
    return {
      tutorId: o.user_id,
      conceptId: o.concept_id,
      name: names?.find((n) => n.id === o.user_id)?.display_name ?? "A student",
      mastery: level && level !== "not_started" ? level : null,
      priceCents: o.tutor_profiles.price_cents!,
      free: o.tutor_profiles.availability,
      sessions: (paid ?? []).filter((p) => p.tutor_id === o.user_id).length,
    };
  });
  const bookedIds = (booked ?? []).map((b) => b.concept_id);

  // The AI decides from refs only (no names or ids in the prompt); the server checks its answer.
  const now = new Date();
  const ctx = buildAgentInput({ now, limitCents, weak, offers: tutorOffers, booked: bookedIds });
  let pick = null;
  let decidedBy: "ai" | "rules" = "rules";
  try {
    const out = (await getGateway().run<TutorAgentOutput>("tutor_agent", { userId: viewer.userId, input: ctx.input }))
      .output;
    pick = checkDecision(out, { ...ctx, limitCents });
    if (pick) decidedBy = "ai";
    else if (out.decision === "none" && !bookedIds.length) pick = null;
  } catch (err) {
    if (!(err instanceof GatewayError)) throw err;
  }
  pick ??= rulesPick(weak, tutorOffers, bookedIds, limitCents);
  if (!pick)
    throw new RouteError(409, "You already have sessions booked for the topics a tutor could help with.", "all_booked");

  const tutor = tutorOffers.find((o) => o.tutorId === pick.tutorId && o.conceptId === pick.conceptId)!;
  // Older open drafts are replaced by this one.
  await admin
    .from("agent_proposals")
    .update({ status: "dismissed" })
    .eq("user_id", viewer.userId)
    .eq("status", "proposed");
  const { data: row, error } = await admin
    .from("agent_proposals")
    .insert({
      user_id: viewer.userId,
      concept_id: pick.conceptId,
      tutor_id: pick.tutorId,
      starts_at: slotToDate(now, pick.dayOffset, pick.hour).toISOString(),
      price_cents: tutor.priceCents,
      spend_limit_cents: limitCents,
      reason: pick.reason.slice(0, 600),
      considered: { weakTopics: weak.length, tutors: tutorOffers.length, overLimit },
      decided_by: decidedBy,
    })
    .select("*")
    .single();
  if (error || !row) throw new RouteError(503, "Ifiok couldn't save the suggestion. Try again.", "save_failed");
  return toView(row);
}
