import "server-only";
import { lagosDay } from "@ifiok/core";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// My earnings (06 §0, §2, §4, 10 MVP-06): usage points and Units earned, recorded and pending until
// the wallet ships (E-03). No cash moves and no naira amount is shown before a pool exists.

export type EarningsView = {
  month: string;
  pointsThisMonth: number;
  pointsAllTime: number;
  unitsThisMonth: number;
  unitsPending: number;
  unitsCap: number;
  shares: {
    id: string;
    title: string;
    kind: string;
    state: "checking" | "approved" | "held" | "rejected";
    reason: string | null;
    points: number;
  }[];
  explainers: { id: string; title: string; status: string; reason: string | null; points: number }[];
};

export async function getEarnings(viewer: Viewer): Promise<EarningsView> {
  const supabase = await createClient();
  const month = `${lagosDay().slice(0, 7)}-01`;
  const [{ data: points }, { data: units }, { data: shares }, { data: explainers }, usage] = await Promise.all([
    supabase.from("usage_points").select("resource_kind, resource_id, month").eq("contributor_id", viewer.userId),
    supabase.from("earned_units_pending").select("units, month").eq("user_id", viewer.userId),
    supabase
      .from("sources")
      .select("id, title, kind, review, review_reason")
      .eq("owner_id", viewer.userId)
      .not("shared_at", "is", null)
      .order("shared_at", { ascending: false }),
    supabase
      .from("explainers")
      .select("id, title, status, review_reason")
      .eq("author_id", viewer.userId)
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false }),
    getConfig("usage"),
  ]);
  const count = (kind: string, id: string) =>
    (points ?? []).filter((p) => p.resource_kind === kind && p.resource_id === id).length;
  const cap = usage.earned_units_monthly_cap;
  return {
    month,
    pointsThisMonth: (points ?? []).filter((p) => p.month === month).length,
    pointsAllTime: (points ?? []).length,
    unitsThisMonth: (units ?? []).filter((u) => u.month === month).reduce((s, u) => s + u.units, 0),
    unitsPending: (units ?? []).reduce((s, u) => s + u.units, 0),
    unitsCap: cap,
    shares: (shares ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      state:
        s.review === "approved"
          ? "approved"
          : s.review === "needs_review"
            ? "held"
            : s.review === "rejected"
              ? "rejected"
              : "checking",
      reason: s.review === "approved" ? null : s.review_reason,
      points: count("source", s.id),
    })),
    explainers: (explainers ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      reason: e.review_reason,
      points: count("explainer", e.id),
    })),
  };
}
