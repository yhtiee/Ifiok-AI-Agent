import { describe, expect, it } from "vitest";
import { greeting, parseNames } from "./names";

describe("parseNames", () => {
  it("accepts Nigerian names with tone marks, hyphens and apostrophes, tidying spaces", () => {
    expect(parseNames("  Adébáyọ̀ ", "Ọ̀kọ̀n-Udo")).toEqual({ ok: true, first: "Adébáyọ̀", last: "Ọ̀kọ̀n-Udo" });
    expect(parseNames("Mary  Jane", "O'Neil")).toEqual({ ok: true, first: "Mary Jane", last: "O'Neil" });
  });

  it("says which name is missing", () => {
    expect(parseNames("", "Obi")).toMatchObject({ ok: false, field: "first_name", message: "Enter your first name." });
    expect(parseNames("Ada", "   ")).toMatchObject({ ok: false, field: "last_name", message: "Enter your last name." });
  });

  it("refuses digits, symbols and names over 40 characters", () => {
    expect(parseNames("Ada1", "Obi")).toMatchObject({ ok: false, field: "first_name" });
    expect(parseNames("Ada", "<b>Obi</b>")).toMatchObject({ ok: false, field: "last_name" });
    expect(parseNames("a".repeat(41), "Obi")).toMatchObject({ ok: false, field: "first_name" });
  });
});

describe("greeting", () => {
  // Nigeria is UTC+1 all year.
  it("uses Lagos time", () => {
    expect(greeting("Ada", new Date("2026-10-10T07:30:00Z"))).toBe("Good morning, Ada");
    expect(greeting("Ada", new Date("2026-10-10T11:00:00Z"))).toBe("Good afternoon, Ada");
    expect(greeting("Ada", new Date("2026-10-10T16:00:00Z"))).toBe("Good evening, Ada");
    expect(greeting("Ada", new Date("2026-10-10T23:30:00Z"))).toBe("Good morning, Ada");
  });

  it("drops the name when there isn't one", () => {
    expect(greeting("", new Date("2026-10-10T07:30:00Z"))).toBe("Good morning");
    expect(greeting(null, new Date("2026-10-10T16:00:00Z"))).toBe("Good evening");
  });
});
