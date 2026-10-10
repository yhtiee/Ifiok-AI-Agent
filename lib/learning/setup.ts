import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SetupStep = { key: string; label: string; done: boolean };

/**
 * The "get started" checklist on Today, from real rows (read under RLS). A student is set up once
 * they have chosen something to learn, set a goal and finished a first lesson screen.
 */
export async function getSetupSteps(userId: string): Promise<SetupStep[]> {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [courses, topics, goals, screens] = await Promise.all([
    count(supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("concept_follows").select("*", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("goals").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("active", true)),
    count(supabase.from("screen_events").select("*", { count: "exact", head: true }).eq("user_id", userId)),
  ]);

  return [
    { key: "account", label: "Create your account", done: true },
    { key: "profile", label: "Set your level and study time", done: true },
    { key: "learn", label: "Choose a course or topic", done: courses + topics > 0 },
    { key: "goal", label: "Set a goal", done: goals > 0 },
    { key: "lesson", label: "Finish your first lesson screen", done: screens > 0 },
  ];
}
