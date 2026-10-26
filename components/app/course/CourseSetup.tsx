"use client";

import { useRouter } from "next/navigation";
import { OutlineSetup } from "@/components/app/outline/OutlineSetup";
import { handOffEdit, startParam } from "@/components/app/outline/outline-modes";

// A member's course with no outline yet: the Set up block is the whole page (app-overhaul §4a).
// What the student added opens on the outline page to be checked and saved.
export function CourseSetup({ courseId }: { courseId: string }) {
  const router = useRouter();
  return (
    <OutlineSetup
      courseId={courseId}
      onReady={(mode) => {
        handOffEdit(courseId, mode);
        router.push(`/courses/${courseId}/outline?start=${startParam(mode.source)}`);
      }}
    />
  );
}
