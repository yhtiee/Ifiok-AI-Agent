import { describe, expect, it } from "vitest";
import { buildAgentInput, checkDecision, rulesPick, slotToDate, type TutorOffer, type WeakTopic } from "./agent-rules";

const weak: WeakTopic[] = [
  {
    conceptId: "kvl",
    title: "Kirchhoff's laws",
    evidence: "1 of 5 right this week",
    mistake: "Sign of IR drops",
    m: 0.2,
  },
  { conceptId: "ohm", title: "Ohm's law", evidence: "3 of 6 right this week", mistake: null, m: 0.45 },
];
const offers: TutorOffer[] = [
  {
    tutorId: "ada",
    conceptId: "kvl",
    name: "Ada O.",
    mastery: "mastered",
    priceCents: 800,
    free: "Evenings",
    sessions: 2,
  },
  { tutorId: "bola", conceptId: "kvl", name: "Bola A.", mastery: null, priceCents: 500, free: "Weekends", sessions: 0 },
  {
    tutorId: "chi",
    conceptId: "ohm",
    name: "Chi E.",
    mastery: "proficient",
    priceCents: 600,
    free: "Mornings",
    sessions: 1,
  },
];
const now = new Date("2026-11-01T09:00:00Z");
const ctx = () => ({ ...buildAgentInput({ now, limitCents: 1000, weak, offers, booked: [] }), limitCents: 1000 });

describe("Ifiok's tutoring agent (12 §4 Q63)", () => {
  it("gives the model refs, never names or ids", () => {
    const { input } = ctx();
    const text = JSON.stringify(input);
    for (const secret of ["Ada", "Bola", "Chi", "ada", "kvl"]) expect(text).not.toContain(secret);
    expect(input.tutors.map((t) => t.ref)).toEqual(["T1", "T2", "T3"]);
    expect(input.tutors[0]).toMatchObject({ topic: "W1", mastery: "Mastered", price: "$8.00" });
    expect(input.limit).toBe("$10.00");
  });

  it("accepts a valid choice and puts the tutor's name in on the server", () => {
    const pick = checkDecision(
      {
        decision: "propose",
        topic: "W1",
        tutor: "T1",
        day_offset: 1,
        hour: 18,
        reason: "You got 1 of 5 right on Kirchhoff's laws. {tutor} has Mastered it and has taught 2 sessions.",
      },
      ctx(),
    );
    expect(pick).toEqual({
      conceptId: "kvl",
      tutorId: "ada",
      dayOffset: 1,
      hour: 18,
      reason: "You got 1 of 5 right on Kirchhoff's laws. Ada O. has Mastered it and has taught 2 sessions.",
    });
  });

  it("rejects a tutor for another topic, an unknown ref, a bad time or a number it wasn't given", () => {
    const base = {
      decision: "propose" as const,
      topic: "W1",
      tutor: "T1",
      day_offset: 1,
      hour: 18,
      reason: "{tutor} can help.",
    };
    expect(checkDecision({ ...base, tutor: "T3" }, ctx())).toBeNull();
    expect(checkDecision({ ...base, tutor: "T9" }, ctx())).toBeNull();
    expect(checkDecision({ ...base, hour: 3 }, ctx())).toBeNull();
    expect(checkDecision({ ...base, day_offset: 30 }, ctx())).toBeNull();
    expect(checkDecision({ ...base, reason: "{tutor} raised scores by 40% for students." }, ctx())).toBeNull();
    expect(checkDecision({ decision: "none", reason: "No session would help." }, ctx())).toBeNull();
  });

  it("never goes over the student's limit", () => {
    const tight = { ...buildAgentInput({ now, limitCents: 600, weak, offers, booked: [] }), limitCents: 600 };
    expect(
      checkDecision(
        { decision: "propose", topic: "W1", tutor: "T1", day_offset: 1, hour: 18, reason: "{tutor}" },
        tight,
      ),
    ).toBeNull();
    // The rules fall back to the best tutor that fits: Bola at $5.00.
    expect(rulesPick(weak, offers, [], 600)).toMatchObject({ conceptId: "kvl", tutorId: "bola" });
  });

  it("the rules skip topics already booked and prefer mastery", () => {
    expect(rulesPick(weak, offers, [], 1000)).toMatchObject({ tutorId: "ada", hour: 18, dayOffset: 1 });
    expect(rulesPick(weak, offers, ["kvl"], 1000)).toMatchObject({ conceptId: "ohm", tutorId: "chi" });
    expect(rulesPick(weak, offers, ["kvl", "ohm"], 1000)).toBeNull();
  });

  it("turns a day and hour into the right Lagos time", () => {
    // 1 Nov, 10:00 Lagos → tomorrow 18:00 Lagos = 17:00 UTC.
    expect(slotToDate(now, 1, 18).toISOString()).toBe("2026-11-02T17:00:00.000Z");
    // Late evening UTC is already the next day in Lagos.
    expect(slotToDate(new Date("2026-11-01T23:30:00Z"), 1, 9).toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });
});
