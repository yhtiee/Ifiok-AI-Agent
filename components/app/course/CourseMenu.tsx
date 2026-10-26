"use client";

import { ClockCounterClockwiseIcon, DotsThreeIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The course overflow (app-overhaul §5.4): rare actions for members. A locked outline can only be
// looked at, so it offers the history alone.
export function CourseMenu({ courseId, locked }: { courseId: string; locked: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Course options" className="text-ink">
          <DotsThreeIcon size={24} weight="bold" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {locked ? null : (
          <DropdownMenuItem asChild>
            <Link href={`/courses/${courseId}/outline`}>
              <PencilSimpleIcon size={20} aria-hidden="true" /> Edit outline
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/courses/${courseId}/outline#history`}>
            <ClockCounterClockwiseIcon size={20} aria-hidden="true" /> Outline history
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
