import { describe, expect, it } from "vitest";
import { DSL_VERSION, MASTERY_LEVELS } from "@ifiok/core";

describe("@ifiok/core", () => {
  it("resolves through the workspace and exposes spec constants", () => {
    expect(DSL_VERSION).toBe(1);
    expect(MASTERY_LEVELS).toEqual(["Not started", "Familiar", "Proficient", "Mastered"]);
  });
});
