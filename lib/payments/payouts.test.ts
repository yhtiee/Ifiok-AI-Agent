import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({ getGateway: () => ({ run: vi.fn() }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/config", () => ({ getConfig: async () => ({}) }));
vi.mock("./paypal", () => ({ getPaypal: () => ({}) }));
vi.mock("./tutoring", () => ({ payTutorsWaitingFor: async () => {} }));

const { numbersAllowed, plainExplanation } = await import("./payouts");

describe("payout explanations (10 MVP-07, guardrail 2)", () => {
  const input = {
    month: "October 2026",
    points: 14,
    sources: [
      { title: "Kinematics notes", kind: "notes", points: 9 },
      { title: "Projectiles", kind: "explainer", points: 5 },
    ],
    pool: "$50.00",
    total_points: 70,
    amount: "$10.00",
    capped: true,
  };

  it("writes the plain sentence from the recorded numbers", () => {
    expect(plainExplanation(input)).toBe(
      'You earned 14 points in October 2026: 9 from your notes "Kinematics notes", 5 from your explainer "Projectiles". ' +
        "The pool was $50.00, shared across 70 points from every contributor, so your share is $10.00. " +
        "No one gets more than 20% of a month's pool, so your share stops there.",
    );
  });

  it("keeps the AI's wording only when every number in it was given", () => {
    const allowed = ["14", "70", "$50.00", "$10.00", "20", "9", "5", "October", "2026"];
    expect(numbersAllowed("You earned 14 points: 9 from your notes and 5 from a video, so $10.00.", allowed)).toBe(
      true,
    );
    expect(numbersAllowed("That's 20% of the $50.00 pool, or about $10.71.", allowed)).toBe(false);
    expect(numbersAllowed("Your points were 14.3% of the total.", allowed)).toBe(false);
  });
});
