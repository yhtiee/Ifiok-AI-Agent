// The tutoring agent's checks (12 §4 Q63), kept pure so they're tested on their own. The model
// sees refs (W1, T1), never names or ids; whatever it answers is checked here before the student
// sees it: the refs must exist and match, the tutor must be within the limit, the time must be in
// range, and every number in the reason must be one it was given (guardrail 2). If not, the rules
// pick instead.

import type { TutorAgentInput, TutorAgentOutput } from "@ifiok/core/ai/skills/tutoring";

export type WeakTopic = {
  conceptId: string;
  title: string;
  evidence: string;
  mistake: string | null;
  /** Lower is weaker (mastery estimate). */
  m: number;
};
export type TutorOffer = {
  tutorId: string;
  conceptId: string;
  name: string;
  mastery: string | null;
  priceCents: number;
  free: string;
  sessions: number;
};
export type Pick = { conceptId: string; tutorId: string; dayOffset: number; hour: number; reason: string };

const RANK: Record<string, number> = { mastered: 3, proficient: 2, familiar: 1 };
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const MASTERY_WORDS: Record<string, string> = { familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };

export function buildAgentInput(args: {
  now: Date;
  limitCents: number;
  weak: WeakTopic[];
  offers: TutorOffer[];
  booked: string[];
}): { input: TutorAgentInput; topicRef: Map<string, string>; tutorRef: Map<string, TutorOffer> } {
  const topicRef = new Map(args.weak.map((w, i) => [`W${i + 1}`, w.conceptId]));
  const refOf = new Map([...topicRef].map(([ref, id]) => [id, ref]));
  const tutorRef = new Map(args.offers.map((o, i) => [`T${i + 1}`, o]));
  return {
    topicRef,
    tutorRef,
    input: {
      now: args.now.toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }),
      limit: usd(args.limitCents),
      weak_topics: args.weak.map((w) => ({
        ref: refOf.get(w.conceptId)!,
        title: w.title,
        evidence: w.evidence,
        mistake: w.mistake,
      })),
      tutors: [...tutorRef].map(([ref, o]) => ({
        ref,
        topic: refOf.get(o.conceptId)!,
        mastery: o.mastery ? (MASTERY_WORDS[o.mastery] ?? null) : null,
        price: usd(o.priceCents),
        free: o.free,
        sessions_completed: o.sessions,
      })),
      already_booked: args.booked.flatMap((id) => (refOf.get(id) ? [refOf.get(id)!] : [])),
    },
  };
}

/** Every number in the text must be one of the numbers given (guardrail 2). */
export function onlyGivenNumbers(text: string, input: TutorAgentInput, hour: number, dayOffset: number): boolean {
  const given = new Set<string>();
  const add = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).forEach((n) => given.add(n));
  add(JSON.stringify(input));
  for (const n of [hour, hour % 12 || 12, dayOffset]) given.add(String(n));
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => given.has(n));
}

/** The model's answer, if it passes every check; null otherwise. */
export function checkDecision(
  out: TutorAgentOutput,
  ctx: { input: TutorAgentInput; topicRef: Map<string, string>; tutorRef: Map<string, TutorOffer>; limitCents: number },
): Pick | null {
  if (out.decision !== "propose" || !out.topic || !out.tutor) return null;
  const conceptId = ctx.topicRef.get(out.topic);
  const tutor = ctx.tutorRef.get(out.tutor);
  if (!conceptId || !tutor || tutor.conceptId !== conceptId) return null;
  if (tutor.priceCents > ctx.limitCents) return null;
  if (ctx.input.already_booked.includes(out.topic)) return null;
  const dayOffset = out.day_offset ?? 1;
  const hour = out.hour ?? 18;
  if (dayOffset < 1 || dayOffset > 7 || hour < 8 || hour > 21) return null;
  if (!out.reason.includes("{tutor}") && /\bT\d+\b/.test(out.reason)) return null;
  if (!onlyGivenNumbers(out.reason, ctx.input, hour, dayOffset)) return null;
  return { conceptId, tutorId: tutor.tutorId, dayOffset, hour, reason: out.reason.replaceAll("{tutor}", tutor.name) };
}

/** The fallback: the weakest unbooked topic, its best tutor (mastery, then sessions, then price), tomorrow at 6 pm. */
export function rulesPick(weak: WeakTopic[], offers: TutorOffer[], booked: string[], limitCents: number): Pick | null {
  for (const w of [...weak].sort((a, b) => a.m - b.m)) {
    if (booked.includes(w.conceptId)) continue;
    const best = offers
      .filter((o) => o.conceptId === w.conceptId && o.priceCents <= limitCents)
      .sort(
        (a, b) =>
          (RANK[b.mastery ?? ""] ?? 0) - (RANK[a.mastery ?? ""] ?? 0) ||
          b.sessions - a.sessions ||
          a.priceCents - b.priceCents,
      )[0];
    if (!best) continue;
    const masteryWords = best.mastery && MASTERY_WORDS[best.mastery] ? `, ${MASTERY_WORDS[best.mastery]} on Ifiok` : "";
    return {
      conceptId: w.conceptId,
      tutorId: best.tutorId,
      dayOffset: 1,
      hour: 18,
      reason: `${w.evidence} on ${w.title}. ${best.name} tutors it${masteryWords}, for ${usd(best.priceCents)}.`,
    };
  }
  return null;
}

/** The session start: `dayOffset` days from now (Lagos date) at `hour` Lagos time (UTC+1, no DST). */
export function slotToDate(now: Date, dayOffset: number, hour: number): Date {
  const lagos = new Date(now.getTime() + 3600_000);
  const d = new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + dayOffset, hour - 1, 0, 0),
  );
  return d;
}
