import { describe, expect, it } from "vitest";
import { buildPlan, daysUntil, type PlanTopic } from "./planner";

// MVP-04 "Done when": the plan covers every topic before the exam date and front-loads high-share
// weak topics; it is deterministic.

const topic = (id: string, over: Partial<PlanTopic> = {}): PlanTopic => ({
  conceptId: id,
  title: id,
  share: 0.25,
  asked: 2,
  m: 0.2,
  level: "not_started",
  practice: 10,
  pastQuestions: 3,
  ...over,
});

const base = { today: "2026-11-01", examDate: "2026-11-11", dailyMinutes: 30, papers: 3 };

describe("buildPlan", () => {
  it("covers every topic before the exam date", () => {
    const topics = Array.from({ length: 8 }, (_, i) => topic(`t${i}`, { share: 0.125 }));
    const plan = buildPlan({ ...base, topics });
    const planned = new Set(plan.days.flatMap((d) => d.sessions.map((s) => s.conceptId)).filter(Boolean));
    expect(planned.size).toBe(8);
    expect(plan.overflow).toBeNull();
    expect(plan.days.every((d) => d.date < base.examDate)).toBe(true);
  });

  it("front-loads topics with a big share of marks that the student is weak in", () => {
    const plan = buildPlan({
      ...base,
      topics: [
        topic("small-weak", { share: 0.05, m: 0.1 }),
        topic("big-strong", { share: 0.5, m: 0.9, level: "mastered" }),
        topic("big-weak", { share: 0.45, m: 0.1 }),
      ],
    });
    expect(plan.days[0]!.sessions[0]!.conceptId).toBe("big-weak");
    const order = plan.days.flatMap((d) => d.sessions).map((s) => s.conceptId);
    expect(order.indexOf("big-weak")).toBeLessThan(order.indexOf("small-weak"));
  });

  it("says why each session is there, in counts, never predictions", () => {
    const plan = buildPlan({ ...base, topics: [topic("SQL", { share: 0.24, asked: 6 })], papers: 8 });
    const s = plan.days[0]!.sessions[0]!;
    expect(s.why).toBe("Asked in 6 of 8 papers · ~24% of marks; you're not started");
    expect(JSON.stringify(plan)).not.toMatch(/predict|likely to appear/i);
  });

  it("starts weak topics with the lesson, then practice and past questions", () => {
    const plan = buildPlan({ ...base, topics: [topic("a")] });
    expect(plan.days.flatMap((d) => d.sessions).map((s) => s.kind)).toEqual([
      "lesson",
      "practice",
      "past_questions",
      "paper",
    ]);
  });

  it("puts a timed practice paper on the last day", () => {
    const plan = buildPlan({ ...base, topics: [topic("a")] });
    expect(plan.days.at(-1)!.sessions.at(-1)!.kind).toBe("paper");
    expect(plan.days.at(-1)!.date).toBe("2026-11-10");
  });

  it("names the topics that don't fit and the daily minutes that would", () => {
    const topics = Array.from({ length: 20 }, (_, i) => topic(`t${i}`, { share: 0.05 }));
    const plan = buildPlan({ ...base, examDate: "2026-11-03", dailyMinutes: 20, topics });
    expect(plan.overflow?.titles.length).toBeGreaterThan(0);
    expect(plan.overflow!.suggestedMinutes).toBeGreaterThan(20);
  });

  it("is deterministic and copes with no papers or a past exam date", () => {
    const topics = [topic("b", { share: null, asked: 0 }), topic("a", { share: null, asked: 0 })];
    const one = buildPlan({ ...base, papers: 0, topics });
    expect(buildPlan({ ...base, papers: 0, topics })).toEqual(one);
    expect(one.days[0]!.sessions[0]!.why).toBe("In your outline; you're not started");
    expect(buildPlan({ ...base, examDate: "2026-10-30", topics }).days).toEqual([]);
  });

  it("says getting started for a tried topic still below Familiar", () => {
    const plan = buildPlan({
      ...base,
      papers: 0,
      topics: [topic("a", { share: null, asked: 0, level: "getting_started" })],
    });
    expect(plan.days[0]!.sessions[0]!.why).toBe("In your outline; you're getting started");
  });
});

describe("daysUntil", () => {
  it("lists every day up to the day before the exam", () => {
    expect(daysUntil("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });
});
