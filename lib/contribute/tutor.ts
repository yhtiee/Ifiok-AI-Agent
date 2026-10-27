import "server-only";
import { z } from "zod";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import type { MasteryLevel } from "@/lib/courses/path-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Tutor profiles (F17-FR1, profile only, 10 MVP-06): the topics a student offers to teach and when
// they're free. No mastery is required (12 §4 Q52); a tutor's Ifiok mastery shows to learners when
// they have it, read from server-written evidence. Bookings and payments open after launch.

export const tutorBody = z.object({
  availability: z.string().trim().min(3, "Say when you're usually free.").max(300),
  concept_ids: z.array(z.string().uuid()).min(1, "Pick at least one topic.").max(20),
  active: z.boolean(),
});

export type TutorProfile = { availability: string; active: boolean; concepts: { id: string; title: string }[] };

export async function getTutorProfile(viewer: Viewer): Promise<TutorProfile | null> {
  const supabase = await createClient();
  const [{ data: profile }, { data: topics }] = await Promise.all([
    supabase.from("tutor_profiles").select("availability, active").eq("user_id", viewer.userId).maybeSingle(),
    supabase.from("tutor_concepts").select("concept_id, concepts(title)").eq("user_id", viewer.userId),
  ]);
  if (!profile) return null;
  return {
    availability: profile.availability,
    active: profile.active,
    concepts: (topics ?? []).map((t) => ({ id: t.concept_id, title: t.concepts?.title ?? "Topic" })),
  };
}

export async function saveTutorProfile(viewer: Viewer, body: z.infer<typeof tutorBody>) {
  const admin = createAdminClient();
  const { data: known } = await admin.from("concepts").select("id").in("id", body.concept_ids);
  if ((known ?? []).length !== new Set(body.concept_ids).size)
    throw new RouteError(422, "One of those topics doesn't exist any more. Pick again.", "unknown_topic");
  const { error } = await admin.from("tutor_profiles").upsert({
    user_id: viewer.userId,
    availability: body.availability,
    active: body.active,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new RouteError(503, "Ifiok couldn't save your profile. Try again.", "save_failed");
  await admin.from("tutor_concepts").delete().eq("user_id", viewer.userId);
  await admin
    .from("tutor_concepts")
    .insert([...new Set(body.concept_ids)].map((concept_id) => ({ user_id: viewer.userId, concept_id })));
}

export type TutorCard = { name: string; mastery: MasteryLevel | null; availability: string; isYou: boolean };

/** Students offering to tutor a topic, with their Ifiok mastery of it when they have one. */
export async function tutorsForConcept(viewer: Viewer, conceptId: string): Promise<TutorCard[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("tutor_concepts")
    .select("user_id, tutor_profiles!inner(availability, active)")
    .eq("concept_id", conceptId)
    .eq("tutor_profiles.active", true)
    .limit(20);
  const ids = (rows ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const admin = createAdminClient();
  const [{ data: people }, { data: mastery }] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", ids),
    admin.from("mastery").select("user_id, level").eq("concept_id", conceptId).in("user_id", ids),
  ]);
  return (rows ?? []).map((r) => {
    const level = mastery?.find((m) => m.user_id === r.user_id)?.level;
    return {
      name: people?.find((p) => p.id === r.user_id)?.display_name ?? "A student",
      mastery: level && level !== "not_started" ? (level as MasteryLevel) : null,
      availability: r.tutor_profiles.availability,
      isYou: r.user_id === viewer.userId,
    };
  });
}
