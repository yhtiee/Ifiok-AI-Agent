import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) => prefix.every((part, i) => key[i] === part);

describe("queryKeys", () => {
  it("nests every course key under the courses prefix, so one invalidation covers them", () => {
    const prefix = queryKeys.courses.all();
    for (const key of [
      queryKeys.courses.mine(),
      queryKeys.courses.search("MTH 101"),
      queryKeys.courses.detail("c1"),
      queryKeys.courses.outline("c1"),
    ]) {
      expect(startsWith(key, prefix)).toBe(true);
    }
    expect(startsWith(queryKeys.courses.outline("c1"), queryKeys.courses.detail("c1"))).toBe(true);
  });

  it("normalises search terms so the same search shares a cache entry", () => {
    expect(queryKeys.courses.search("  MTH 101 ")).toEqual(queryKeys.courses.search("mth 101"));
  });
});
