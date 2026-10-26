import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURES, featureFlags, type FeatureFlags } from "@/lib/features";
import {
  JUDGES_UNTIL,
  faqGroups,
  joinList,
  landingCopy,
  metaDescription,
  openFeatureList,
  whatWorksToday,
} from "./copy";
import { landingJsonLd, serializeJsonLd } from "./jsonld";

const today = featureFlags();
const allOpen = Object.fromEntries(Object.keys(today).map((k) => [k, true])) as FeatureFlags;
const before = new Date("2026-10-19T12:00:00Z");
const after = new Date("2026-11-20T12:00:00Z");

describe("flags", () => {
  it("everything through virtual labs is open today", () => {
    const open = Object.entries(FEATURES)
      .filter(([, v]) => v.open)
      .map(([k]) => k)
      .sort();
    expect(open).toEqual([
      "course",
      "examPrep",
      "labs",
      "outline",
      "path",
      "practice",
      "privateLessons",
      "sharedLessons",
      "topic",
      "upload",
      "weakAreas",
    ]);
  });
});

describe("landing copy against today's flags (04 §5)", () => {
  const copy = landingCopy(today, before);

  it("uses the open hero line once uploads, the Path and private lessons are live", () => {
    expect(copy.heroLead).toContain("built from your own material");
    expect(landingCopy({ ...today, path: false }).heroLead).toContain("are being built now");
  });

  it("journey badges follow the flags", () => {
    const labels = copy.journey.map((s) => s.badges.map((b) => b.label));
    expect(labels).toEqual([
      ["Open now"],
      ["Open now"],
      ["Building now"],
      ["Building now"],
      ["Points and Units: Building now", "Cash: After launch"],
    ]);
  });

  it("has no unbuilt Learn items left once labs are open", () => {
    expect(copy.learnItems.filter((i) => i.badge?.status === "building")).toHaveLength(0);
    expect(copy.learnItems.slice(0, 2).every((i) => !i.badge)).toBe(true);
  });

  it("generates 'What works today' exactly as 04 §5.10 renders it today", () => {
    expect(whatWorksToday(today)).toBe(
      "Today: find or create your course, add the outline, open lessons for any topic, lessons from your notes, your Path, practice and weak areas, exam prep, and virtual labs. Being built now: sharing, explainers and earnings. After launch, when payments are set up: Plus billing, Units top-ups, cash payouts, paid curating and tutoring bookings.",
    );
  });

  it("tutoring status line and earn table use the closed variants", () => {
    expect(copy.teach.tutoringStatus).toBe("Tutoring: Building now. Bookings and payments: After launch.");
    expect(copy.earnRows.find((r) => r.way === "Tutoring")!.status[0]!.label).toBe("After launch");
    expect(copy.moneyLines).toHaveLength(2);
    expect(copy.moneyLines.join(" ")).not.toMatch(/sandbox/i);
  });

  it("answers the textbook question by the upload flag and gates the judges' sandbox questions", () => {
    const faq = faqGroups(today, before);
    expect(faq.main.find((f) => f.q.startsWith("Is my textbook"))!.a).toMatch(
      /^No\. Ifiok reads your PDF on your phone/,
    );
    const closed = faqGroups({ ...today, upload: false }, before);
    expect(closed.main.find((f) => f.q.startsWith("Is my textbook"))!.a).toMatch(/^When uploads open: No\./);
    expect(faq.judges.map((f) => f.q)).toEqual(["How does Ifiok use AI?"]);
    expect(faqGroups(today, after).judges).toEqual([]);
    expect(JUDGES_UNTIL.toISOString()).toBe("2026-11-12T20:00:00.000Z");
  });

  it("says tutor messages are coming later and billing opens with payments", () => {
    const rows = copy.pricing.rows;
    expect(rows.some((r) => r.feature === "Tutor messages (coming later)")).toBe(true);
    expect(rows.find((r) => r.feature === "Billing")!.plus).toBe("Opens with payments");
  });

  it("meta description is the open variant once uploads and exam prep are live, and fits 155 characters", () => {
    expect(metaDescription(today)).toMatch(/^Turn your course outline/);
    expect(metaDescription(today).length).toBeLessThanOrEqual(155);
    expect(metaDescription(allOpen).length).toBeLessThanOrEqual(155);
  });
});

describe("landing copy when every flag is open", () => {
  const copy = landingCopy(allOpen, after);

  it("drops Building now everywhere", () => {
    const badges = [...copy.journey.flatMap((s) => s.badges), ...copy.earnRows.flatMap((r) => r.status)];
    expect(badges.some((b) => b.status === "building" || b.status === "after")).toBe(false);
    expect(copy.learnItems.some((i) => i.badge)).toBe(false);
    expect(copy.prepare.badge).toBeUndefined();
  });

  it("uses the open variants, including sandbox lines", () => {
    expect(copy.heroLead).toContain("built from your own material");
    expect(copy.teach.tutoringStatus).toMatch(/^The learner's payment is held/);
    expect(copy.moneyLines.join(" ")).toContain("PayPal sandbox");
    expect(whatWorksToday(allOpen)).not.toContain("Being built now");
    expect(whatWorksToday(allOpen)).not.toContain("After launch");
    expect(copy.faq.judges.map((f) => f.q)).toContain("Is the code public?");
  });
});

describe("JSON-LD", () => {
  it("FAQPage carries exactly the visible questions and answers", () => {
    const faq = faqGroups(today, before);
    const ld = landingJsonLd({ siteUrl: "https://ifiok.test/", flags: today, faq, description: "d" });
    const page = ld["@graph"].find((n) => n["@type"] === "FAQPage") as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    const visible = [...faq.main, ...faq.judges];
    expect(page.mainEntity.map((q) => q.name)).toEqual(visible.map((f) => f.q));
    expect(page.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(visible.map((f) => f.a));
  });

  it("lists only open features, keeps Plus unavailable and never adds ratings", () => {
    const ld = landingJsonLd({
      siteUrl: "https://ifiok.test",
      flags: today,
      faq: { main: [], judges: [] },
      description: "d",
    });
    const app = ld["@graph"].find((n) => n["@type"] === "WebApplication") as {
      featureList: string[];
      offers: Record<string, unknown>[];
    };
    expect(app.featureList).toEqual(openFeatureList(today));
    expect(app.featureList).toHaveLength(9);
    expect(app.offers.filter((o) => "availability" in o)).toHaveLength(1);
    const text = JSON.stringify(ld);
    expect(text).not.toMatch(/aggregateRating|"review"|sameAs/);
  });

  it("escapes < so the script tag can't be closed early", () => {
    expect(serializeJsonLd({ a: "</script>" })).toBe('{"a":"\\u003c/script>"}');
  });
});

describe("voice rules (CLAUDE.md, guardrail 13)", () => {
  const all = JSON.stringify([landingCopy(today, before), landingCopy(allOpen, before)]);
  it.each([
    /predicted/i,
    /likely to appear/i,
    /lecturer/i,
    /guaranteed/i,
    /\bcoins?\b/i,
    /\bgems?\b/i,
    /\btokens?\b/i,
    /magic/i,
    /invitation/i,
  ])("never says %s", (re) => expect(all).not.toMatch(re));
  it("has no emoji", () => expect(all).not.toMatch(/\p{Extended_Pictographic}/u));
});

describe("tokens only (07 §3.3)", () => {
  const roots = ["components/marketing/landing", "components/marketing/illustrations", "components/marketing/demos"];
  const files = roots.flatMap((r) =>
    readdirSync(r, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(tsx|css)$/.test(f))
      .map((f) => join(r, f)),
  );
  it.each(files)("%s has no hard-coded colours", (file) => {
    // The one data: URI tick in landing.css is white-on-green inside an SVG image, not a page colour.
    const text = readFileSync(file, "utf8").replace(/url\("data:[^"]*"\)/g, "");
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(text).not.toMatch(/\brgba?\(/);
  });

  it("joinList", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b", "c"])).toBe("a, b and c");
    expect(joinList(["a", "b", "c"], true)).toBe("a, b, and c");
  });
});
