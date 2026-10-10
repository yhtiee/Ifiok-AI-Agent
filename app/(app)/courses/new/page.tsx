import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getSubjects } from "@/lib/courses/read";
import { createClient } from "@/lib/supabase/server";
import { CreateCourseForm } from "./CreateCourseForm";

export const metadata: Metadata = { title: "Add a course", robots: { index: false } };

// Create a course at the student's university (F2-FR1). No admin approval.
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
      description={`Add your course at ${university?.name ?? "your university"}. Classmates who search for it will join you.`}
    >
      <CreateCourseForm
        subjects={subjects}
        defaultLevel={viewer.profile.level}
        initialCode={typeof params.code === "string" ? params.code : ""}
        initialTitle={typeof params.title === "string" ? params.title : ""}
      />
    </AppPage>
  );
}
