import "server-only";
import { lagosDay, studyStreak } from "@ifiok/core";
import { createClient } from "@/lib/supabase/server";

export type LearningSummary = {
  streakDays: number;
  studiedToday: boolean;
  topicsMastered: number;
  topicsStarted: number;
};

/**
 * Today's headline numbers, read under RLS from server-written tables only
 * (daily_activity and mastery, CLAUDE.md guardrail 6). Every figure is counted, never estimated.
 */
export async function getLearningSummary(userId: string): Promise<LearningSummary> {
  const supabase = await createClient();
  const today = lagosDay();
  const since = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [activity, mastered, started] = await Promise.all([
    supabase.from("daily_activity").select("day").eq("user_id", userId).gt("sessions", 0).gte("day", since),
    supabase.from("mastery").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("level", "mastered"),
    supabase
      .from("mastery")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("level", "not_started"),
  ]);

  const days = (activity.data ?? []).map((r) => r.day);
  return {
    streakDays: studyStreak(days, today),
    studiedToday: days.includes(today),
    topicsMastered: mastered.count ?? 0,
    topicsStarted: started.count ?? 0,
  };
}
