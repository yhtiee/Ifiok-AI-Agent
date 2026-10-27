"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Library search, type chips, topic filter and Upload (12 §4 Q58, Q59). Filters live in the URL,
// so a filtered view can be shared and the page stays server-rendered.

const TYPES = [
  ["all", "All"],
  ["video", "Videos"],
  ["voice", "Voice"],
  ["text", "Written"],
  ["notes", "Notes"],
  ["lab_manual", "Manuals"],
  ["past_paper", "Past questions"],
  ["solution", "Solutions"],
] as const;

export function LibraryFilters(props: {
  q: string;
  topic: string;
  type: string;
  topics: { id: string; title: string }[];
}) {
  const router = useRouter();
  const searchId = useId();
  const topicId = useId();
  const [q, setQ] = useState(props.q);
  const go = (next: { q?: string; topic?: string; type?: string }) => {
    const params = new URLSearchParams();
    const query = next.q ?? q;
    const topic = next.topic ?? props.topic;
    const type = next.type ?? props.type;
    if (query.trim()) params.set("q", query.trim());
    if (topic) params.set("topic", topic);
    if (type && type !== "all") params.set("type", type);
    router.push(`/library${params.size ? `?${params}` : ""}`);
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          role="search"
          className="flex min-w-60 flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({});
          }}
        >
          <label htmlFor={searchId} className="grid flex-1 gap-1.5">
            <span className="sr-only">Search the library</span>
            <Input id={searchId} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" />
          </label>
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <MagnifyingGlassIcon size={20} aria-hidden="true" />
          </Button>
        </form>
        {props.topics.length ? (
          <label htmlFor={topicId} className="grid gap-1.5">
            <span className="sr-only">Topic</span>
            <select
              id={topicId}
              value={props.topic}
              onChange={(e) => go({ topic: e.target.value })}
              className={cn(fieldClass, "w-56")}
            >
              <option value="">All topics</option>
              {props.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <ActionBar>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Upload</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/me/explainers/new">Make an explainer</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/library/upload">Upload notes, a manual or past questions</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ActionBar>
      </div>
      {/* Type chips: one row, scrolls sideways on phones. */}
      <div role="group" aria-label="What to show" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TYPES.map(([value, label]) => {
          const on = props.type === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => go({ type: value })}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-base whitespace-nowrap",
                on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:bg-paper",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
