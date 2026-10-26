"use client";

import {
  CheckCircleIcon,
  HourglassMediumIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { ActionBar, EmptyState, Row, RowList } from "@/components/app/Page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteMaterial,
  useMaterials,
  useMaterialSearch,
  type Material,
  type MaterialScope,
} from "@/lib/queries/materials";
import { ApiError } from "@/lib/query/api";
import { SOURCE_KIND_LABELS } from "@ifiok/core/materials/kinds";

// A course's Materials tab (app-overhaul §5.4, 10 MVP-01): each material's status in words, delete
// (asked first), and find things in them. Adding happens on /materials/add only.

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");

const STATUS = {
  processing: { label: "Processing", Icon: HourglassMediumIcon, className: "text-ink-2" },
  ready: { label: "Ready", Icon: CheckCircleIcon, className: "text-built" },
  failed: { label: "Couldn't finish: delete and add again", Icon: WarningCircleIcon, className: "text-bad" },
} as const;

/** `addHref` adds the "Add materials" action; leave it out where adding is already on screen. */
export function MaterialsList({ scope, addHref }: { scope: MaterialScope; addHref?: string }) {
  const list = useMaterials(scope);
  const materials = list.data?.materials ?? [];

  const add = addHref ? (
    <ActionBar>
      <Button asChild>
        <Link href={addHref}>Add materials</Link>
      </Button>
    </ActionBar>
  ) : null;

  if (list.isPending) {
    return (
      <div className="grid gap-4">
        {add}
        <div className="grid gap-2" aria-busy="true" aria-label="Loading your materials">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="grid gap-4">
        {add}
        <p role="alert" className="text-base text-bad">
          {errorText(list.error)}
        </p>
      </div>
    );
  }

  if (!materials.length) {
    return (
      <div className="grid gap-2">
        <EmptyState
          title="No materials yet"
          body="Add lecture notes, textbook pages, past questions or a lab manual. Lessons for the topics they cover are built from them."
        />
        {add}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-10">
      <div className="grid content-start gap-4">
        {add}
        <RowList label="Your materials">
          {materials.map((m) => (
            <MaterialRow key={m.id} material={m} />
          ))}
        </RowList>
      </div>
      <MaterialSearch scope={scope} />
    </div>
  );
}

function MaterialRow({ material: m }: { material: Material }) {
  const del = useDeleteMaterial();
  const status = STATUS[m.status];

  return (
    <Row
      title={m.title}
      meta={
        <span className="grid gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{SOURCE_KIND_LABELS[m.kind] ?? m.kind}</span>
            <span aria-hidden="true">·</span>
            <span>
              {m.pageCount} {m.pageCount === 1 ? "page" : "pages"}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`inline-flex items-center gap-1 ${status.className}`}>
              <status.Icon size={16} aria-hidden="true" /> {status.label}
            </span>
          </span>
          {del.isError ? (
            <span role="alert" className="text-bad">
              {errorText(del.error)}
            </span>
          ) : null}
        </span>
      }
      trailing={
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${m.title}`}
              disabled={del.isPending}
              aria-busy={del.isPending}
            >
              <TrashIcon size={20} aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete “{m.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Lessons already built from it stay. It won&apos;t be used again.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => del.mutate(m.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      }
    />
  );
}

function MaterialSearch({ scope }: { scope: MaterialScope }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const search = useMaterialSearch(scope, deferred);
  const hits = search.data?.hits ?? [];

  return (
    <section className="grid content-start gap-3">
      <Label htmlFor="find-in-materials">Find in your materials</Label>
      <div className="relative">
        <MagnifyingGlassIcon
          size={20}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2"
          aria-hidden="true"
        />
        <Input
          id="find-in-materials"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. range of a projectile"
          maxLength={300}
          className="pl-10"
        />
      </div>
      {deferred.trim().length >= 2 ? (
        search.isPending ? (
          <div className="grid gap-2" aria-busy="true" aria-label="Searching">
            <Skeleton className="h-16" />
          </div>
        ) : search.isError ? (
          <p role="alert" className="text-base text-bad">
            {errorText(search.error)}
          </p>
        ) : hits.length === 0 ? (
          <p className="text-base text-ink-2">Nothing in your materials matches that yet.</p>
        ) : (
          <ol className="divide-y divide-line border-y border-line" aria-label="Matches">
            {hits.map((h, i) => (
              <li key={`${h.sourceId}-${h.page}-${i}`} className="grid gap-1 py-3">
                <span className="text-sm font-semibold">
                  {h.title}
                  {h.page ? `, p. ${h.page}` : ""}
                </span>
                <span className="text-base text-ink-2">{h.snippet}</span>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </section>
  );
}
