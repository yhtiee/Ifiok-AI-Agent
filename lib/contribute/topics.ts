import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { getFollowedTopics, getMyCourses } from "@/lib/courses/read";
import { createClient } from "@/lib/supabase/server";

// The topics a student can pick when explaining or offering to tutor (MVP-06): their courses'
// outline topics and the topics they follow. Any topic is allowed; no mastery is required (Q52).

export type TopicOption = { conceptId: string; title: string; group: string };

export async function myTopicOptions(viewer: Viewer): Promise<TopicOption[]> {
  const [courses, followed] = await Promise.all([getMyCourses(viewer), getFollowedTopics(viewer)]);
  const supabase = await createClient();
  const { data: topics } = courses.length
    ? await supabase
        .from("topics")
        .select("course_id, concept_id, title, position")
        .in(
          "course_id",
          courses.map((c) => c.id),
        )
        .is("archived_at", null)
        .not("concept_id", "is", null)
        .order("position")
    : { data: [] };
  const seen = new Set<string>();
  const out: TopicOption[] = [];
  for (const c of courses) {
    for (const t of (topics ?? []).filter((x) => x.course_id === c.id)) {
      if (!t.concept_id || seen.has(t.concept_id)) continue;
      seen.add(t.concept_id);
      out.push({ conceptId: t.concept_id, title: t.title, group: c.code });
    }
  }
  for (const t of followed) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ conceptId: t.id, title: t.title, group: "Your topics" });
  }
  return out;
}
