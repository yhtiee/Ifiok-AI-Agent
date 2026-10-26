"use client";

import { DotsThreeIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// The lesson header's overflow menu loads after the lesson (it's rarely used), keeping the
// lesson shell inside its 200 KB budget. Until then the same trigger shows, inert.
const LessonMenu = dynamic(() => import("./LessonMenu").then((m) => m.LessonMenu), {
  ssr: false,
  loading: () => (
    <Button variant="ghost" size="icon" aria-label="Lesson options" className="text-ink" disabled>
      <DotsThreeIcon size={24} weight="bold" aria-hidden="true" />
    </Button>
  ),
});

export function LessonMenuLazy({ conceptId }: { conceptId: string }) {
  return <LessonMenu conceptId={conceptId} />;
}
