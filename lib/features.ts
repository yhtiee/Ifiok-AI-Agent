// Where each student-facing feature lives, and whether it is open yet. The dashboard and sidebar
// show every entry point from the spec; entries that aren't open render as "Opens soon" instead
// of linking to an empty page. The ticket that ships a feature flips `open` to true.

export type FeatureKey =
  "course" | "topic" | "outline" | "upload" | "textbook" | "goal" | "tutor" | "labs" | "snap" | "library";

export const FEATURES: Record<FeatureKey, { href: string; open: boolean; spec: string }> = {
  course: { href: "/courses", open: true, spec: "F2 · P1-01" },
  topic: { href: "/courses", open: true, spec: "F2 · P1-01" },
  outline: { href: "/courses", open: true, spec: "F2-FR2 · P1-01" },
  upload: { href: "/library/upload", open: false, spec: "F11 · P1-03b" },
  textbook: { href: "/library/textbook", open: false, spec: "F3 · P1-16" },
  goal: { href: "/goals/new", open: false, spec: "F6 · P1-06" },
  tutor: { href: "/tutor", open: false, spec: "F1 · P1-07" },
  labs: { href: "/labs", open: false, spec: "F4 · P1-08" },
  snap: { href: "/practice/snap", open: false, spec: "F7 · P1-10" },
  library: { href: "/library", open: false, spec: "F11 · P1-03b" },
};
