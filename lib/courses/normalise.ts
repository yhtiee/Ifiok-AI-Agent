// Pure helpers for student-created courses and concepts (F2-FR1, F2-FR3, 03 §2).

/** "mth101", "Mth-101", "MTH  101" → "MTH 101" (letters, a space, the rest). Null if it isn't a course code. */
export function formatCourseCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = compact.match(/^([A-Z]{2,6})(\d{2,4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : null;
}

/** Same rule as the generated column courses.code_norm. */
export function courseCodeNorm(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type LevelBand = "foundation" | "introductory" | "intermediate" | "advanced";

/** Course or profile level → concept level band, from app_config.level_bands (03 §2). */
export function levelBandFor(level: number | null | undefined, bands: Record<string, string>): LevelBand {
  const band = (level ? bands[String(level)] : undefined) ?? bands.default ?? "introductory";
  return (
    ["foundation", "introductory", "intermediate", "advanced"].includes(band) ? band : "introductory"
  ) as LevelBand;
}

/** Concept slug: "<subject>.<kebab-title>", e.g. "mathematics.limits-of-a-function". */
export function conceptSlug(subject: string, title: string): string {
  const kebab = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${subject}.${kebab || "topic"}`;
}

/** Tidy a topic title typed by a student: trim, collapse spaces, cap length. */
export function cleanTitle(raw: string, max = 120): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}
