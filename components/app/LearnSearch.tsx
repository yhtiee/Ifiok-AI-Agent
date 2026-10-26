"use client";

import { BooksIcon, PlusIcon, TargetIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconDisc } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseSearch, useJoinCourse, useLearnTopic } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

// "What do you want to learn?" (app-overhaul §5.2): one inline search (shadcn Command, results
// from the server). Courses at the student's university, then "Add this course", then "Learn it
// as a topic". Rows, not cards; the search is this screen's action, so there's no camwood button.

type Props = { universityName: string | null; myCourseIds: string[]; focusOnOpen?: boolean; topicMode?: boolean };

const LABEL = "What do you want to learn?";

/** Course codes look like "MTH 101": used to prefill the create form. */
const looksLikeCode = (q: string) => /^[A-Za-z]{2,6}\s*-?\s*\d{2,4}[A-Za-z]?$/.test(q.trim());

export function LearnSearch({ universityName, myCourseIds, focusOnOpen = false, topicMode = false }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = useCourseSearch(universityName ? debounced : "");
  const join = useJoinCourse();
  const learn = useLearnTopic();
  const mine = new Set(myCourseIds);
  const term = query.trim();
  const isCode = looksLikeCode(term);
  const courses = debounced === term ? (search.data?.courses ?? []) : [];
  const loading = Boolean(universityName) && !search.data && !search.isError;

  const learnTopic = (topic: string) => {
    setNotice(null);
    setSuggestions([]);
    learn.mutate(topic, {
      onSuccess: (result) => {
        if (result.status === "too_broad") {
          setSuggestions(result.suggestions);
          setNotice(`“${topic}” covers a lot. Pick a narrower topic to start with:`);
        } else {
          router.push(`/learn/${result.concept.id}`);
        }
      },
      onError: (err) => setNotice(err instanceof ApiError ? err.message : "Couldn't add that topic. Try again."),
    });
  };

  const createHref = `/courses/new?${new URLSearchParams(isCode ? { code: term } : { title: term })}`;
  // Enter picks a course when there is one, else adds a code, else learns the topic.
  const preferred = courses[0] ? `course:${courses[0].id}` : universityName && isCode ? "add" : "learn";

  return (
    // cmdk labels its input itself (a visually hidden label): the visible heading repeats it.
    <Command shouldFilter={false} value={selected || preferred} onValueChange={setSelected} label={LABEL}>
      <p aria-hidden="true" className="text-lg font-semibold">
        {LABEL}
      </p>
      <CommandInput
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          setSelected("");
          setNotice(null);
          setSuggestions([]);
        }}
        // Opened from "Find your course" on Today: the student came here to type.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={focusOnOpen}
        placeholder={
          universityName && !topicMode ? "A course code like MTH 101, or any topic" : "Any topic, like Fourier series"
        }
      />

      {notice ? (
        <div role="status" className="grid gap-3 text-base">
          <p>{notice}</p>
          {suggestions.length ? (
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <Button variant="outline" size="sm" onClick={() => learnTopic(s)} disabled={learn.isPending}>
                    {s}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {term.length >= 2 ? (
        <CommandList aria-label="Results">
          {universityName ? (
            <CommandGroup heading={`Courses at ${universityName}`}>
              {loading ? (
                <div aria-label="Searching courses" className="grid gap-2 px-4 py-2">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : null}
              {courses.map((c) => {
                const isMine = mine.has(c.id);
                const busy = join.isPending && join.variables === c.id;
                return (
                  <div key={c.id} className="flex items-center gap-2 pr-4 has-[[data-selected=true]]:bg-accent">
                    <CommandItem
                      value={`course:${c.id}`}
                      onSelect={() => router.push(`/courses/${c.id}`)}
                      className="min-w-0 flex-1 pr-0"
                    >
                      <IconDisc tone="course">
                        <BooksIcon size={22} />
                      </IconDisc>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-base font-semibold [overflow-wrap:anywhere]">
                          {c.code} · {c.title}
                        </span>
                        <span className="text-sm text-ink-2">
                          {c.members} {c.members === 1 ? "classmate" : "classmates"}
                        </span>
                      </span>
                    </CommandItem>
                    {isMine ? (
                      <Button variant="outline" size="sm" onClick={() => router.push(`/courses/${c.id}`)}>
                        Open
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={join.isPending}
                        aria-busy={busy}
                        aria-label={`Join ${c.code}`}
                        onClick={() => join.mutate(c.id, { onSuccess: () => router.push(`/courses/${c.id}`) })}
                      >
                        {busy ? "Joining…" : "Join"}
                      </Button>
                    )}
                  </div>
                );
              })}
              <CommandItem value="add" onSelect={() => router.push(createHref)}>
                <IconDisc tone="add">
                  <PlusIcon size={22} />
                </IconDisc>
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-base font-semibold [overflow-wrap:anywhere]">
                    Add {isCode ? term.toUpperCase() : "a course"} at {universityName}
                  </span>
                  <span className="text-sm text-ink-2">Not listed yet? Add it; classmates can join you.</span>
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}
          {!isCode ? (
            <CommandGroup>
              <CommandItem
                value="learn"
                disabled={learn.isPending}
                aria-busy={learn.isPending}
                onSelect={() => learnTopic(term)}
              >
                <IconDisc tone="topic">
                  <TargetIcon size={22} />
                </IconDisc>
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-base font-semibold [overflow-wrap:anywhere]">
                    {learn.isPending ? "Finding the topic…" : `Learn “${term}” as a topic`}
                  </span>
                  <span className="text-sm text-ink-2">No course needed</span>
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      ) : (
        <p className="text-sm text-ink-2">
          {universityName && !topicMode
            ? `Search your course at ${universityName}, or type any topic, like “Fourier series”.`
            : "Type any topic, like “Fourier series” or “judicial precedent”."}
        </p>
      )}
    </Command>
  );
}
