// Where each student-facing feature lives, and whether it is open yet. The dashboard and sidebar
// show every entry point from the spec; entries that aren't open render as "Opens soon" instead
// of linking to an empty page. The ticket that ships a feature flips `open` to true.
// The landing page (specifications/landing/04 §4.2) reads these flags for every status badge and
// every flag-dependent line, so flipping a flag also updates the public page.

export type FeatureKey =
  | "course"
  | "topic"
  | "outline"
  | "sharedLessons"
  | "upload"
  | "privateLessons"
  | "path"
  | "practice"
  | "weakAreas"
  | "examPrep"
  | "textbook"
  | "goal"
  | "tutor"
  | "labs"
  | "snap"
  | "library"
  | "share"
  | "explainers"
  | "earnings"
  | "tutorProfiles"
  | "sandboxPayments"
  | "curating"
  | "plusBilling"
  | "tutoringBookings"
  | "cashPayouts"
  | "codePublic";

export type Feature = { href: string; open: boolean; spec: string };

export const FEATURES: Record<FeatureKey, Feature> = {
  course: { href: "/courses", open: true, spec: "F2 · P1-01" },
  topic: { href: "/courses", open: true, spec: "F2 · P1-01" },
  outline: { href: "/courses", open: true, spec: "F2-FR2 · P1-01" },
  sharedLessons: { href: "/courses", open: true, spec: "F2 · P1-02" },
  upload: { href: "/library/upload", open: false, spec: "F11 · MVP-01" },
  privateLessons: { href: "/courses", open: false, spec: "MVP-02" },
  path: { href: "/courses", open: false, spec: "MVP-02" },
  practice: { href: "/practice", open: false, spec: "MVP-02/03" },
  weakAreas: { href: "/practice", open: false, spec: "MVP-03" },
  examPrep: { href: "/practice/exam", open: false, spec: "F8 · MVP-04" },
  textbook: { href: "/library/textbook", open: false, spec: "F3 · P1-16" },
  goal: { href: "/goals/new", open: false, spec: "F6 · P1-06" },
  tutor: { href: "/tutor", open: false, spec: "F1 · P1-07" },
  labs: { href: "/labs", open: false, spec: "F4 · MVP-05" },
  snap: { href: "/practice/snap", open: false, spec: "F7 · P1-10" },
  library: { href: "/library", open: false, spec: "F11 · P1-03b" },
  share: { href: "/library/share", open: false, spec: "F11 · MVP-06" },
  explainers: { href: "/me/explainers", open: false, spec: "F18 · MVP-06" },
  earnings: { href: "/me/earnings", open: false, spec: "06 §2–§4 · MVP-06" },
  tutorProfiles: { href: "/me/tutor", open: false, spec: "F17 · MVP-06" },
  /** Hackathon only: PayPal sandbox payouts and bookings with test money (MVP-07, 12 §4 Q43). */
  sandboxPayments: { href: "/me/earnings", open: false, spec: "MVP-07" },
  curating: { href: "/me/curate", open: false, spec: "06 §13 · E-02" },
  plusBilling: { href: "/me/plan", open: false, spec: "06 §2 · E-03" },
  tutoringBookings: { href: "/me/tutor", open: false, spec: "F17 · E-05" },
  cashPayouts: { href: "/me/earnings", open: false, spec: "06 §3 · E-06" },
  /** The repository is public on GitHub (OWN-H7). The licence is named only once a LICENSE exists. */
  codePublic: { href: "https://github.com/yhtiee/Ifiok-AI-Agent", open: false, spec: "OWN-H7" },
};

export type FeatureFlags = Record<FeatureKey, boolean>;

/** Every flag as a plain boolean, for code that only needs open/closed. */
export function featureFlags(features: Record<FeatureKey, Feature> = FEATURES): FeatureFlags {
  return Object.fromEntries(Object.entries(features).map(([k, v]) => [k, v.open])) as FeatureFlags;
}
