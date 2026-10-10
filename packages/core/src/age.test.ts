import { describe, expect, it } from "vitest";
import { isAdultByBirthMonth, isPlausibleBirthMonth, lagosYearMonth } from "./age";

// 10 Oct 2026, 12:00 Lagos
const now = new Date("2026-10-10T11:00:00Z");

describe("isAdultByBirthMonth", () => {
  it("treats someone born 18 years ago this month as not yet 18 (day unknown)", () => {
    expect(isAdultByBirthMonth(2008, 10, now)).toBe(false);
  });
  it("is adult once the 18th birthday month has passed", () => {
    expect(isAdultByBirthMonth(2008, 9, now)).toBe(true);
    expect(isAdultByBirthMonth(1999, 4, now)).toBe(true);
  });
  it("is not adult for 17-year-olds or births later in the year", () => {
    expect(isAdultByBirthMonth(2008, 11, now)).toBe(false);
    expect(isAdultByBirthMonth(2009, 1, now)).toBe(false);
  });
  it("uses Lagos time at the month boundary", () => {
    // 31 Oct 23:30 UTC is already 1 Nov 00:30 in Lagos: October 2008 births become 18.
    const boundary = new Date("2026-10-31T23:30:00Z");
    expect(lagosYearMonth(boundary)).toEqual({ year: 2026, month: 11 });
    expect(isAdultByBirthMonth(2008, 10, boundary)).toBe(true);
  });
});

describe("isPlausibleBirthMonth", () => {
  it("rejects future dates, bad months and implausible years", () => {
    expect(isPlausibleBirthMonth(2026, 11, now)).toBe(false);
    expect(isPlausibleBirthMonth(2000, 13, now)).toBe(false);
    expect(isPlausibleBirthMonth(1899, 5, now)).toBe(false);
    expect(isPlausibleBirthMonth(2000, 5, now)).toBe(true);
  });
});
