"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useJoinCourse } from "@/lib/queries/courses";

export function JoinCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const join = useJoinCourse();
  return (
    <Button
      onClick={() => join.mutate(courseId, { onSuccess: () => router.refresh() })}
      disabled={join.isPending}
      aria-busy={join.isPending}
    >
      {join.isPending ? "Joining…" : "Join this course"}
    </Button>
  );
}
