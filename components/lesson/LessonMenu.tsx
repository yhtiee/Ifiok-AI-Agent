"use client";

import { DotsThreeIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The lesson header's overflow for a topic the student follows (app-overhaul §5.6): its materials
// are added on /materials/add, not under the lesson.
export function LessonMenu({ conceptId }: { conceptId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Lesson options" className="text-ink">
          <DotsThreeIcon size={24} weight="bold" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/materials/add?topic=${conceptId}`}>
            <UploadSimpleIcon size={20} aria-hidden="true" /> Add materials for this topic
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
