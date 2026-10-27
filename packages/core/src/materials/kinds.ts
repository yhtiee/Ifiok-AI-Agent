// What a student can add as materials (10 MVP-01, F11-FR1), shared by the page picker in the
// browser and the server checks. Kept dependency-free so client code can import it.

export const MATERIAL_KINDS = ["outline", "notes", "textbook", "past_questions", "lab_manual", "solutions"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

/** Each kind's `source_kind`. Course outlines don't become sources: they go to scheme_extract. */
export const SOURCE_KIND_OF = {
  notes: "notes",
  textbook: "textbook_private",
  past_questions: "past_paper",
  lab_manual: "lab_manual",
  solutions: "solution",
} as const satisfies Record<Exclude<MaterialKind, "outline">, string>;

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  outline: "Course outline",
  notes: "Lecture notes",
  textbook: "Textbook pages",
  past_questions: "Past questions",
  lab_manual: "Lab manual",
  solutions: "Worked solutions",
};

/** Kinds a student may share to the contribution pool (F11-FR1): never textbook pages. */
export const SHAREABLE_SOURCE_KINDS = ["notes", "past_paper", "lab_manual", "solution"] as const;

export const SOURCE_KIND_LABELS: Record<string, string> = {
  notes: "Lecture notes",
  textbook_private: "Textbook pages",
  past_paper: "Past questions",
  lab_manual: "Lab manual",
  solution: "Worked solutions",
};

export const MATERIAL_LIMITS = {
  /** Pages per upload (10 MVP-01). */
  maxPages: 80,
  /** Characters kept per page; a dense A4 page is about 4,000. */
  maxPageChars: 12_000,
  /** Pasted text, sent as one page with no page number. */
  maxPasteChars: 60_000,
  /** Outline pages sent to scheme_extract. */
  maxOutlinePages: 6,
  maxOutlineChars: 20_000,
  /** PDFs over this are refused before opening (F3 edge cases). */
  maxFileBytes: 100 * 1024 * 1024,
  /** A page with fewer characters than this has no usable text layer (a scan). */
  minPageChars: 20,
  titleMax: 120,
  uploadsPerDay: 10,
} as const;
