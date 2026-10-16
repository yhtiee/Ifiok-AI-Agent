// Strips personal details from text sent to a free-tier provider. Gemini's terms say "Do not
// submit sensitive, confidential, or personal information to the Unpaid Services" (12 §4 Q25),
// and the gateway never sends names, emails or account ids itself. This catches what students
// type: email addresses, Nigerian phone numbers, and long ID-like numbers (NIN, BVN, matric).
// Maths survives: ordinary numbers are untouched; only 10+ digit runs and phone shapes match.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// +234 / 234 / 0, then 7–9 and 0–1, then 8 digits, allowing spaces or dashes between groups.
const NG_PHONE = /(?<![\d])(?:\+?234[\s-]?|0)[789][01](?:[\s-]?\d){8}(?![\d])/g;
// Any other run of 10 or more digits (NIN and BVN are 11 digits).
const LONG_NUMBER = /(?<![\d.])\d{10,}(?![\d.])/g;
// Matric-style ids such as "UU/2019/12345" or "CSC/18/0456".
const MATRIC = /\b[A-Z]{2,5}\/\d{2,4}\/\d{3,6}\b/g;

export type RedactionResult = { text: string; redacted: number };

export function redactPersonalData(text: string): RedactionResult {
  let redacted = 0;
  const swap = (label: string) => () => {
    redacted++;
    return `[${label} removed]`;
  };
  const out = text
    .replace(EMAIL, swap("email"))
    .replace(NG_PHONE, swap("phone number"))
    .replace(MATRIC, swap("ID number"))
    .replace(LONG_NUMBER, swap("ID number"));
  return { text: out, redacted };
}
