"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaterials } from "@/lib/queries/materials";

// Path · Materials · Exam prep · Labs on a course with an outline (app-overhaul §5.4, MVP-04). The tab is kept in ?tab= so a
// link (or the redirect after adding materials) can open Materials; switching tabs only rewrites
// the URL, it doesn't reload the page.

export type CourseTab = "path" | "materials" | "exam" | "labs";

export function CourseTabs(props: {
  courseId: string;
  initial: CourseTab;
  path: ReactNode;
  materials: ReactNode;
  /** Exam prep (MVP-04): only once the course has an outline to tag questions to. */
  exam?: ReactNode;
  /** Labs (MVP-05): this course's virtual labs and "Request a lab". */
  labs?: ReactNode;
}) {
  const [tab, setTab] = useState<CourseTab>(props.initial);
  const list = useMaterials({ courseId: props.courseId });
  const count = list.data?.materials.length;

  const change = (value: string) => {
    const next: CourseTab =
      value === "materials" || (value === "exam" && props.exam) || (value === "labs" && props.labs)
        ? (value as CourseTab)
        : "path";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "path") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <Tabs value={tab} onValueChange={change}>
      <TabsList aria-label="Course">
        <TabsTrigger value="path">Path</TabsTrigger>
        <TabsTrigger value="materials">Materials{count === undefined ? "" : ` (${count})`}</TabsTrigger>
        {props.exam ? <TabsTrigger value="exam">Exam prep</TabsTrigger> : null}
        {props.labs ? <TabsTrigger value="labs">Labs</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="path">{props.path}</TabsContent>
      <TabsContent value="materials">{props.materials}</TabsContent>
      {props.exam ? <TabsContent value="exam">{props.exam}</TabsContent> : null}
      {props.labs ? <TabsContent value="labs">{props.labs}</TabsContent> : null}
    </Tabs>
  );
}
