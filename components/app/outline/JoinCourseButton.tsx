"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useJoinCourse } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

export function JoinCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const join = useJoinCourse();
  return (
    <Button
      onClick={() =>
        join.mutate(courseId, {
          onSuccess: () => router.refresh(),
          onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't join the course. Try again."),
        })
      }
      disabled={join.isPending}
      aria-busy={join.isPending}
    >
      {join.isPending ? "Joining…" : "Join course"}
    </Button>
  );
}
