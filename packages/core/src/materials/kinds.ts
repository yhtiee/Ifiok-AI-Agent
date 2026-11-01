// What a student can add as materials (10 MVP-01, F11-FR1, 12 §4 Q60), shared by the uploader in the
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
  textbook: "Textbook",
  past_questions: "Past questions",
  lab_manual: "Lab manual",
  solutions: "Worked solutions",
};

/** Kinds a student may share to the Library (F11-FR1; textbook pages too since 12 §4 Q60). */
export const SHAREABLE_SOURCE_KINDS = ["notes", "past_paper", "lab_manual", "solution", "textbook_private"] as const;

/** The private bucket uploaded files are stored in (12 §4 Q60), under `{owner}/{source}/`. */
export const MATERIALS_BUCKET = "materials";
/** The most image pages (photos, scanned PDF pages) read per upload; the whole file is still kept. */
export const MAX_OCR_PAGES = 30;

/** Files a student can upload (12 §4 Q60): stored as they are, privately. */
export const FILE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;
export type FileMime = (typeof FILE_MIMES)[number];
export const FILE_EXT: Record<FileMime, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
};
/** What the file picker accepts. */
export const FILE_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,.heic,.webp,application/pdf,image/*";

export const SOURCE_KIND_LABELS: Record<string, string> = {
  notes: "Lecture notes",
  textbook_private: "Textbook",
  past_paper: "Past questions",
  lab_manual: "Lab manual",
  solution: "Worked solutions",
};

export const MATERIAL_LIMITS = {
  /** Pages per upload (10 MVP-01); still the course-outline page limit. */
  maxPages: 80,
  /** Pages of an uploaded file whose text is read for search and lessons (the whole file is kept). */
  maxReadPages: 150,
  /** Largest file stored (12 §4 Q60). */
  maxStoredBytes: 20 * 1024 * 1024,
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
