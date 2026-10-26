import { describe, expect, it } from "vitest";
import { rankWeakAreas, type TopicEvidence } from "./weak-areas";

const topic = (id: string, over: Partial<TopicEvidence> = {}): TopicEvidence => ({
  conceptId: id,
  title: id,
  m: 0.2,
  level: "not_started",
  right7: 1,
  total7: 3,
  wrong14: 2,
  mistake: null,
  practice: 10,
  ...over,
});

describe("rankWeakAreas", () => {
  it("leaves out untried topics and Proficient ones without recent mistakes", () => {
    const ranked = rankWeakAreas([
      topic("untried", { total7: 0, wrong14: 0 }),
      topic("solid", { m: 0.7, level: "proficient", right7: 5, total7: 5, wrong14: 0 }),
      topic("weak"),
    ]);
    expect(ranked.map((r) => r.conceptId)).toEqual(["weak"]);
  });

  it("puts the lowest mastery first, then more recent mistakes", () => {
    const ranked = rankWeakAreas([
      topic("b", { m: 0.4, wrong14: 1 }),
      topic("a", { m: 0.1 }),
      topic("c", { m: 0.4, wrong14: 4 }),
    ]);
    expect(ranked.map((r) => r.conceptId)).toEqual(["a", "c", "b"]);
  });

  it("says the evidence in words and picks one next step", () => {
    const [mostlyWrong] = rankWeakAreas([topic("x", { right7: 2, total7: 6 })]);
    expect(mostlyWrong).toMatchObject({ evidence: "2 of 6 right this week", next: { kind: "lesson" } });
    const [halfRight] = rankWeakAreas([topic("y", { right7: 3, total7: 6 })]);
    expect(halfRight!.next.kind).toBe("practice");
    const [noPractice] = rankWeakAreas([topic("z", { right7: 3, total7: 4, practice: 0 })]);
    expect(noPractice!.next.kind).toBe("lesson");
    const [older] = rankWeakAreas([topic("w", { total7: 0, right7: 0, wrong14: 3 })]);
    expect(older!.evidence).toBe("3 wrong in the last two weeks");
  });

  it("keeps a Proficient topic with fresh mistakes on the list", () => {
    expect(rankWeakAreas([topic("p", { m: 0.65, level: "proficient", wrong14: 2 })])).toHaveLength(1);
  });
});
