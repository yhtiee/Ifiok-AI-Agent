"use client";

import { ArrowRightIcon, BooksIcon, MagnifyingGlassIcon, PlusIcon, TargetIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Button";
import { useCourseSearch, useJoinCourse, useLearnTopic } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

// "What do you want to learn?" (07 §5.1b): one search box. Results are rows, not cards: courses at
// the student's university, then "Add this course", then "Learn it as a topic".

type Props = { universityName: string | null; myCourseIds: string[] };

/** Course codes look like "MTH 101": used to prefill the create form. */
const looksLikeCode = (q: string) => /^[A-Za-z]{2,6}\s*-?\s*\d{2,4}[A-Za-z]?$/.test(q.trim());

export function LearnSearch({ universityName, myCourseIds }: Props) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
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

  const learnTopic = (topic: string) => {
    setNotice(null);
    setSuggestions([]);
    learn.mutate(topic, {
      onSuccess: (result) => {
        if (result.status === "too_broad") {
          setSuggestions(result.suggestions);
          setNotice(`“${topic}” covers a lot. Pick a narrower topic to start with:`);
        } else {
          setQuery("");
          setNotice(`You're following “${result.concept.title}”. Its lesson is built when you first open it.`);
          router.refresh();
        }
      },
      onError: (err) => setNotice(err instanceof ApiError ? err.message : "Couldn't add that topic. Try again."),
    });
  };

  const createHref = `/courses/new?${new URLSearchParams(looksLikeCode(term) ? { code: term } : { title: term })}`;

  return (
    <div className="grid gap-3">
      <label htmlFor={inputId} className="font-display text-xl font-semibold">
        What do you want to learn?
      </label>
      <div className="relative">
        <MagnifyingGlassIcon
          size={20}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice(null);
            setSuggestions([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && term.length >= 2 && !looksLikeCode(term) && !search.data?.courses.length)
              learnTopic(term);
          }}
          placeholder={universityName ? "A course code like MTH 101, or any topic" : "Any topic, like Fourier series"}
          autoComplete="off"
          className="min-h-12 w-full rounded-[var(--radius-input)] border border-line bg-surface pr-3 pl-10 text-base placeholder:text-ink-3"
        />
      </div>

      {notice ? (
        <div role="status" className="rounded-[var(--radius-input)] border border-line bg-surface px-4 py-3 text-base">
          <p>{notice}</p>
          {suggestions.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => learnTopic(s)}
                    className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold hover:border-ink/40"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {term.length >= 2 ? (
        <ul
          aria-label="Results"
          className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line"
        >
          {universityName ? (
            <>
              {search.isPending && debounced === term ? (
                <li className="flex min-h-14 items-center gap-3 bg-surface px-4 text-sm text-ink-2">
                  <Spinner /> Searching courses at {universityName}…
                </li>
              ) : null}
              {(search.data?.courses ?? []).map((c) => {
                const isMine = mine.has(c.id);
                return (
                  <li key={c.id} className="flex min-h-14 items-center gap-3 bg-surface px-4 py-2">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-quantity-soft text-quantity"
                    >
                      <BooksIcon size={22} />
                    </span>
                    <Link href={`/courses/${c.id}`} className="grid min-w-0 flex-1 gap-0.5 hover:underline">
                      <span className="truncate text-base font-semibold">
                        {c.code} · {c.title}
                      </span>
                      <span className="text-sm text-ink-2">
                        {c.members} {c.members === 1 ? "classmate" : "classmates"} at {universityName}
                      </span>
                    </Link>
                    {isMine ? (
                      <Link
                        href={`/courses/${c.id}`}
                        className="min-h-11 shrink-0 px-2 py-3 text-sm font-semibold text-quantity"
                      >
                        Open
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={join.isPending}
                        onClick={() => join.mutate(c.id, { onSuccess: () => router.push(`/courses/${c.id}`) })}
                        className="min-h-11 shrink-0 rounded-full border border-ink/25 px-4 text-sm font-semibold hover:border-ink/50 disabled:opacity-60"
                      >
                        {join.isPending && join.variables === c.id ? "Joining…" : "Join"}
                      </button>
                    )}
                  </li>
                );
              })}
              <li className="bg-surface">
                <Link href={createHref} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-paper">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-change-soft text-change"
                  >
                    <PlusIcon size={22} />
                  </span>
                  <span className="grid flex-1 gap-0.5">
                    <span className="text-base font-semibold">
                      Add {looksLikeCode(term) ? term.toUpperCase() : "a course"} at {universityName}
                    </span>
                    <span className="text-sm text-ink-2">Not listed yet? Create it; classmates can join you.</span>
                  </span>
                  <ArrowRightIcon size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
                </Link>
              </li>
            </>
          ) : null}
          {!looksLikeCode(term) ? (
            <li className="bg-surface">
              <button
                type="button"
                onClick={() => learnTopic(term)}
                disabled={learn.isPending}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-paper disabled:cursor-wait"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-built-soft text-built"
                >
                  {learn.isPending ? <Spinner /> : <TargetIcon size={22} />}
                </span>
                <span className="grid flex-1 gap-0.5">
                  <span className="text-base font-semibold">Learn “{term}” as a topic</span>
                  <span className="text-sm text-ink-2">
                    {learn.isPending ? "Finding the topic…" : "No course needed. Follow it and start learning."}
                  </span>
                </span>
                <ArrowRightIcon size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">
          {universityName
            ? `Search your course at ${universityName}, or type any topic, like “Fourier series” or “judicial precedent”.`
            : "Type any topic, like “Fourier series” or “judicial precedent”. Add your university in Me to find your course."}
        </p>
      )}
    </div>
  );
}
