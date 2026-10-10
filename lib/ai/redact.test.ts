import { describe, expect, it } from "vitest";
import { redactPersonalData } from "./redact";

describe("redactPersonalData", () => {
  it("removes emails, Nigerian phone numbers and ID-like numbers", () => {
    const { text, redacted } = redactPersonalData(
      "Mail ada.obi@gmail.com or call 0803 123 4567 / +2348031234567, NIN 12345678901, matric UU/2019/12345",
    );
    expect(text).toBe(
      "Mail [email removed] or call [phone number removed] / [phone number removed], NIN [ID number removed], matric [ID number removed]",
    );
    expect(redacted).toBe(5);
  });

  it("leaves maths, dates, course codes and ordinary numbers alone", () => {
    const maths =
      "Evaluate ∫ from 1 to 3 of 2x dx = 8; f(x) = 3.14159265358 x^2 + 2026; MTH 101 week 12; 0.000123456789";
    expect(redactPersonalData(maths)).toEqual({ text: maths, redacted: 0 });
  });
});
