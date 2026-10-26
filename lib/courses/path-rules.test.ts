import { describe, expect, it } from "vitest";
import { lessonStateText, masteryText, nextUp, type PathTopic } from "./path-rules";

const topic = (id: string, over: Partial<PathTopic> = {}): PathTopic => ({
  topicId: id,
  title: id,
  week: null,
  conceptId: `c-${id}`,
  lesson: "not_started",
  fromNotes: false,
  covered: false,
  mastery: "not_started",
  tried: false,
  practice: 0,
  ...over,
});

describe("masteryText", () => {
  it("says Getting started for a tried topic still below Familiar, else the level", () => {
    expect(masteryText("not_started", false)).toBe("Not started");
    expect(masteryText("not_started", true)).toBe("Getting started");
    expect(masteryText("familiar", true)).toBe("Familiar");
    expect(masteryText("mastered", false)).toBe("Mastered");
  });
});

describe("nextUp", () => {
  it("is the first topic in outline order that isn't Proficient yet", () => {
    const topics = [
      topic("a", { mastery: "mastered" }),
      topic("b", { mastery: "proficient" }),
      topic("c", { mastery: "familiar" }),
      topic("d"),
    ];
    expect(nextUp(topics)?.topicId).toBe("c");
  });

  it("skips topics that can't be opened yet (no concept)", () => {
    expect(nextUp([topic("a", { conceptId: null }), topic("b")])?.topicId).toBe("b");
  });

  it("is null when every topic is Proficient or Mastered", () => {
    expect(nextUp([topic("a", { mastery: "proficient" }), topic("b", { mastery: "mastered" })])).toBeNull();
    expect(nextUp([])).toBeNull();
  });
});

describe("lessonStateText", () => {
  it("says where the lesson comes from", () => {
    expect(lessonStateText({ lesson: "ready", fromNotes: true, covered: true })).toBe("Lesson from your notes");
    expect(lessonStateText({ lesson: "ready", fromNotes: false, covered: false })).toBe("Lesson ready");
    expect(lessonStateText({ lesson: "building", fromNotes: false, covered: true })).toBe("Building from your notes");
    expect(lessonStateText({ lesson: "not_started", fromNotes: false, covered: false })).toBe("Built on first open");
  });
});
