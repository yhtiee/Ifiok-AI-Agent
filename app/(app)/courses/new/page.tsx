import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getSubjects } from "@/lib/courses/read";
import { createClient } from "@/lib/supabase/server";
import { CreateCourseForm } from "./CreateCourseForm";

export const metadata: Metadata = { title: "Add a course", robots: { index: false } };

// Create a course at the student's university (F2-FR1, app-overhaul §5.3). No admin approval.

const NEXT_STEPS = [
  "Add the course outline: a photo or PDF of it, the topics typed in, or a draft Ifiok makes for you to check.",
  "Each topic becomes a lesson on your Path, built the first time someone opens it.",
  "Add your lecture notes and Ifiok builds the lessons from them, citing the page.",
] as const;
export default async function NewCoursePage({ searchParams }: PageProps<"/courses/new">) {
  const viewer = await requireOnboardedPage();
  if (!viewer.profile.university_id) redirect("/courses");
  const params = await searchParams;
  const supabase = await createClient();
  const [subjects, { data: university }] = await Promise.all([
    getSubjects(),
    supabase.from("universities").select("name").eq("id", viewer.profile.university_id).maybeSingle(),
  ]);

  return (
    <AppPage
      crumbs={[{ label: "Courses", href: "/courses" }, { label: "Add a course" }]}
      title="Add a course"
      description={`At ${university?.name ?? "your university"}. Classmates who search for it will join you.`}
    >
      {/* Wide screens: the form on the left, what happens next on the right; one column on phones. */}
      <div className="grid gap-10 xl:grid-cols-[minmax(0,42rem)_minmax(0,24rem)] xl:gap-16">
        <CreateCourseForm
          subjects={subjects}
          defaultLevel={viewer.profile.level}
          initialCode={typeof params.code === "string" ? params.code : ""}
          initialTitle={typeof params.title === "string" ? params.title : ""}
        />
        <section aria-labelledby="next-steps" className="hidden content-start gap-3 xl:grid">
          <h2 id="next-steps" className="text-base font-semibold">
            What happens next
          </h2>
          <ol className="grid gap-3 text-base text-ink-2">
            {NEXT_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="w-5 shrink-0 font-semibold text-ink tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppPage>
  );
}
