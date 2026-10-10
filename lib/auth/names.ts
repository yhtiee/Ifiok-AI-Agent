import { z } from "zod";
import { NAME_MAX } from "./name-limits";

// Student names (12 §4 Q30). Letters in any script with accents and tone marks (Ọ̀kọ̀n, Adébáyọ̀),
// plus spaces, hyphens, apostrophes and full stops. Max 40, matching the profiles check.

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .\-’]*$/u;

function nameSchema(label: string) {
  return z
    .string()
    .transform((s) => s.normalize("NFC").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, `Enter your ${label}.`)
        .max(NAME_MAX, `Keep your ${label} to ${NAME_MAX} characters or fewer.`)
        .regex(NAME_PATTERN, `Use letters for your ${label}; spaces, hyphens and apostrophes are fine.`),
    );
}

export const firstNameSchema = nameSchema("first name");
export const lastNameSchema = nameSchema("last name");

export type NameField = "first_name" | "last_name";

/** Validates both names; the first problem found, with the field it belongs to. */
export function parseNames(
  first: unknown,
  last: unknown,
): { ok: true; first: string; last: string } | { ok: false; field: NameField; message: string } {
  const f = firstNameSchema.safeParse(String(first ?? ""));
  if (!f.success) return { ok: false, field: "first_name", message: f.error.issues[0]!.message };
  const l = lastNameSchema.safeParse(String(last ?? ""));
  if (!l.success) return { ok: false, field: "last_name", message: l.error.issues[0]!.message };
  return { ok: true, first: f.data, last: l.data };
}

/** "Good morning, Ada" by the clock in Nigeria (WAT), whatever the server's time zone. */
export function greeting(firstName: string | null | undefined, now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(now),
  );
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = firstName?.trim();
  return name ? `${part}, ${name}` : part;
}
