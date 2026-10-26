import { describe, expect, it } from "vitest";
import { pickNext, type TodayCourse } from "./today";

const course = (id: string, over: Partial<TodayCourse> = {}): TodayCourse => ({
  id,
  code: id.toUpperCase(),
  title: `Course ${id}`,
  topics: 2,
  conceptIds: [`${id}-c1`, `${id}-c2`],
  next: { conceptId: `${id}-c1`, title: "Limits" },
  ...over,
});
const topics = [{ id: "t1", title: "Fourier series" }];

describe("Today's Next block", () => {
  it("continues the topic opened last on this device", () => {
    const next = pickNext([course("a"), course("b")], topics, {
      kind: "course",
      courseId: "b",
      conceptId: "b-c2",
      title: "Continuity",
    });
    expect(next).toMatchObject({ kind: "course", label: "Continue", conceptId: "b-c2", title: "Continuity" });
  });

  it("drops a remembered topic that is no longer in the course", () => {
    const next = pickNext([course("a")], topics, { kind: "course", courseId: "a", conceptId: "gone", title: "Old" });
    expect(next).toMatchObject({ kind: "course", label: "Next up", conceptId: "a-c1" });
  });

  it("drops a remembered course the student left, and a topic they unfollowed", () => {
    expect(
      pickNext([course("a")], topics, { kind: "course", courseId: "x", conceptId: "x-c1", title: "X" }),
    ).toMatchObject({
      label: "Next up",
    });
    expect(pickNext([course("a")], topics, { kind: "topic", conceptId: "t9", title: "Gone" })).toMatchObject({
      kind: "course",
      label: "Next up",
    });
  });

  it("continues a followed topic", () => {
    expect(pickNext([course("a")], topics, { kind: "topic", conceptId: "t1", title: "Fourier series" })).toEqual({
      kind: "topic",
      label: "Continue",
      conceptId: "t1",
      title: "Fourier series",
    });
  });

  it("asks for the outline when the newest course has none", () => {
    expect(pickNext([course("a", { topics: 0, conceptIds: [], next: null })], [], null)).toMatchObject({
      kind: "setup",
    });
  });

  it("says when every topic is Proficient, and falls back to the newest topic without courses", () => {
    expect(pickNext([course("a", { next: null })], [], null)).toMatchObject({ kind: "done" });
    expect(pickNext([], topics, null)).toEqual({
      kind: "topic",
      label: "Next up",
      conceptId: "t1",
      title: "Fourier series",
    });
  });
});
