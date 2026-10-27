"use client";

import { ClipboardTextIcon, FilePdfIcon } from "@phosphor-icons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/mini";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupRow } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddMaterial,
  type AddMaterialInput,
  type AddMaterialResult,
  type MaterialScope,
} from "@/lib/queries/materials";
import { ApiError } from "@/lib/query/api";
import { MATERIAL_LABELS, MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";
import { PagePicker, type PickedPage } from "./PagePicker";
import { MaterialsList } from "./MaterialsList";

// Add materials (app-overhaul §5.7, 10 MVP-01): the only way to add them, one step per view.
// Where (a course or a topic; skipped when preset or when there is only one) → What is it? →
// pick PDF pages on the device (only their text is sent) or paste text → back to the course's
// Materials tab or the topic's lesson, with a toast. Outlines are added on the outline page.

export type Destination =
  | { kind: "course"; id: string; label: string; detail: string }
  | { kind: "topic"; id: string; label: string; detail: string };

type Kind = AddMaterialInput["kind"];
const KINDS: Kind[] = ["notes", "textbook", "past_questions", "lab_manual", "solutions"];

type Step = { kind: "where" } | { kind: "what" } | { kind: "pick"; file: File } | { kind: "paste" };

const scopeOf = (d: Destination): MaterialScope => (d.kind === "course" ? { courseId: d.id } : { conceptId: d.id });
const keyOf = (d: Destination) => `${d.kind}:${d.id}`;
const homeOf = (d: Destination) => (d.kind === "course" ? `/courses/${d.id}` : `/learn/${d.id}`);
const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");

const KIND_NOTE: Record<Kind, string> = {
  notes: `Up to ${MATERIAL_LIMITS.maxPages} pages at a time. Only the text of the pages you pick is sent; the PDF stays on your phone. Scanned pages can't be read yet.`,
  textbook: "Textbook pages stay private to you and are never shared. Only the text of the pages you pick is sent.",
  past_questions: `Up to ${MATERIAL_LIMITS.maxPages} pages at a time. Only the text of the pages you pick is sent; the PDF stays on your phone. Scanned pages can't be read yet.`,
  lab_manual: `Up to ${MATERIAL_LIMITS.maxPages} pages at a time. Only the text of the pages you pick is sent; the PDF stays on your phone. Scanned pages can't be read yet.`,
  solutions: `Your own worked solutions. Up to ${MATERIAL_LIMITS.maxPages} pages at a time; only the text of the pages you pick is sent.`,
};

function addedNotice(r: AddMaterialResult) {
  return [
    `Added "${r.material.title}": ${r.material.pageCount} ${r.material.pageCount === 1 ? "page" : "pages"}. It's searchable now and ready for lessons in a minute or two.`,
    r.skippedPages > 0 ? `${r.skippedPages} pages had no readable text and were skipped.` : null,
    r.redacted > 0 ? `Ifiok removed ${r.redacted} phone numbers, emails or ID numbers.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function AddMaterialsFlow({ destinations, initial }: { destinations: Destination[]; initial: string | null }) {
  const preset =
    destinations.find((d) => keyOf(d) === initial) ?? (destinations.length === 1 ? destinations[0]! : null);
  const [chosen, setChosen] = useState<Destination | null>(preset);

  if (destinations.length === 0) {
    return (
      <div className="grid gap-2">
        <EmptyState
          title="First, add a course or a topic"
          body="Materials belong to a course or a topic, so the lessons built from them land in the right place."
        />
        <ActionBar>
          <Button asChild>
            <Link href="/courses?focus=1">Find your course</Link>
          </Button>
        </ActionBar>
      </div>
    );
  }

  if (!chosen) return <WhereStep destinations={destinations} onPick={setChosen} />;

  // Wide screens: the steps on the left, what is already in this course or topic on the right.
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] xl:items-start">
      <AddSteps
        key={keyOf(chosen)}
        destination={chosen}
        onChange={destinations.length > 1 ? () => setChosen(null) : null}
      />
      <section aria-labelledby="already-added" className="hidden gap-3 xl:grid">
        <h2 id="already-added" className="text-base font-semibold">
          Already added
        </h2>
        <MaterialsList scope={scopeOf(chosen)} />
      </section>
    </div>
  );
}

function WhereStep({ destinations, onPick }: { destinations: Destination[]; onPick: (d: Destination) => void }) {
  const [value, setValue] = useState("");
  const courses = destinations.filter((d) => d.kind === "course");
  const topics = destinations.filter((d) => d.kind === "topic");
  const picked = destinations.find((d) => keyOf(d) === value);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (picked) onPick(picked);
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-lg font-semibold">Where do they belong?</legend>
        <RadioGroup
          value={value}
          onValueChange={setValue}
          aria-label="Where do they belong?"
          className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line"
        >
          {[...courses, ...topics].map((d) => (
            <RadioGroupRow key={keyOf(d)} value={keyOf(d)} label={d.label} detail={d.detail} />
          ))}
        </RadioGroup>
      </fieldset>
      <p className="text-sm text-ink-2">
        Not here?{" "}
        <Link href="/courses?focus=1" className="font-semibold text-quantity underline-offset-4 hover:underline">
          Find or add your course
        </Link>
      </p>
      <ActionBar>
        <Button type="submit" disabled={!picked}>
          Next
        </Button>
      </ActionBar>
    </form>
  );
}

function AddSteps({ destination, onChange }: { destination: Destination; onChange: (() => void) | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "what" });
  const [kind, setKind] = useState<Kind>("notes");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = useAddMaterial(scopeOf(destination));
  const home = homeOf(destination);

  const send = (input: AddMaterialInput) => {
    setError(null);
    add.mutate(input, {
      onSuccess: (r) => {
        // Past questions in a course: Exam prep shows them being read, then asks for a review (MVP-04).
        // A lab manual: its practicals become labs; follow them in the course's Labs tab or Practice (MVP-05).
        if (r.labJobId) {
          toast(`${addedNotice(r)} Ifiok is turning its practicals into labs.`);
          router.push(destination.kind === "course" ? `${home}?tab=labs` : "/labs");
          return;
        }
        if (r.examJobId) {
          toast(`${addedNotice(r)} Ifiok is reading the questions; review them in Exam prep.`);
          router.push(`${home}?tab=exam`);
          return;
        }
        toast(addedNotice(r));
        router.push(destination.kind === "course" ? `${home}?tab=materials` : home);
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF, or paste the text.");
      return;
    }
    if (file.size > MATERIAL_LIMITS.maxFileBytes) {
      setError("That PDF is over 100 MB. Split it into smaller files and add the part you need.");
      return;
    }
    setError(null);
    setTitle(file.name.replace(/\.pdf$/i, "").slice(0, MATERIAL_LIMITS.titleMax));
    setStep({ kind: "pick", file });
  };

  const errorLine = error ? (
    <p role="alert" className="text-base text-bad">
      {error}
    </p>
  ) : null;

  const where = (
    <p className="flex flex-wrap items-center gap-x-3 text-base">
      <span className="min-w-0">
        Adding to <span className="font-semibold">{destination.label}</span>
      </span>
      {onChange ? (
        <button
          type="button"
          onClick={onChange}
          className="inline-flex min-h-11 items-center text-base font-semibold text-quantity underline-offset-4 hover:underline"
        >
          Change
        </button>
      ) : null}
    </p>
  );

  if (step.kind === "pick") {
    return (
      <div className="grid gap-5">
        {where}
        <div className="grid gap-1.5">
          <Label htmlFor="material-name">Name</Label>
          <Input
            id="material-name"
            value={title}
            maxLength={MATERIAL_LIMITS.titleMax}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <PagePicker
          file={step.file}
          maxPages={MATERIAL_LIMITS.maxPages}
          confirmLabel={(n) => (n ? `Add ${n} ${n === 1 ? "page" : "pages"}` : "Add pages")}
          busy={add.isPending}
          onConfirm={(pages: PickedPage[]) => send({ kind, title: title.trim() || MATERIAL_LABELS[kind], pages })}
          onCancel={() => {
            setError(null);
            setStep({ kind: "what" });
          }}
        />
        {errorLine}
      </div>
    );
  }

  if (step.kind === "paste") {
    return (
      <div className="grid gap-5">
        {where}
        <PasteForm
          kind={kind}
          busy={add.isPending}
          error={errorLine}
          onCancel={() => {
            setError(null);
            setStep({ kind: "what" });
          }}
          onSubmit={(name, text) =>
            send({ kind, title: name.trim() || MATERIAL_LABELS[kind], pages: [{ page: null, text }] })
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {where}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-lg font-semibold">What is it?</legend>
        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          aria-label="What is it?"
          className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line"
        >
          {KINDS.map((k) => (
            <RadioGroupRow key={k} value={k} label={MATERIAL_LABELS[k]} />
          ))}
        </RadioGroup>
      </fieldset>
      <p className="max-w-[60ch] text-sm text-ink-2">{KIND_NOTE[kind]}</p>
      {errorLine}
      <ActionBar>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setStep({ kind: "paste" });
          }}
          className="px-4 lg:order-2"
        >
          <ClipboardTextIcon size={20} aria-hidden="true" className="max-sm:hidden" /> Paste text
        </Button>
        <Button onClick={() => fileRef.current?.click()} className="px-4">
          <FilePdfIcon size={20} aria-hidden="true" className="max-sm:hidden" /> Choose a PDF
        </Button>
        <Button asChild variant="ghost" className="hidden lg:order-3 lg:inline-flex">
          <Link href={home}>Cancel</Link>
        </Button>
      </ActionBar>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="PDF to add"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const pasteSchema = z.object({
  name: z
    .string()
    .check(z.maxLength(MATERIAL_LIMITS.titleMax, `Keep the name to ${MATERIAL_LIMITS.titleMax} characters or fewer.`)),
  text: z
    .string()
    .check(
      z.trim(),
      z.minLength(MATERIAL_LIMITS.minPageChars, "Paste at least a sentence or two."),
      z.maxLength(
        MATERIAL_LIMITS.maxPasteChars,
        "That's more than one paste can hold. Split it and add the rest next.",
      ),
    ),
});
type PasteValues = z.infer<typeof pasteSchema>;

function PasteForm(props: {
  kind: Kind;
  busy: boolean;
  error: ReactNode;
  onCancel: () => void;
  onSubmit: (name: string, text: string) => void;
}) {
  const form = useForm<PasteValues>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { name: MATERIAL_LABELS[props.kind], text: "" },
  });
  const text = useWatch({ control: form.control, name: "text" });
  const tooShort = text.trim().length < MATERIAL_LIMITS.minPageChars;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => props.onSubmit(v.name, v.text))} noValidate className="grid gap-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input maxLength={MATERIAL_LIMITS.titleMax} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Text</FormLabel>
              <FormControl>
                <Textarea rows={10} maxLength={MATERIAL_LIMITS.maxPasteChars} {...field} />
              </FormControl>
              <FormDescription>
                {text.length.toLocaleString("en-GB")} of {MATERIAL_LIMITS.maxPasteChars.toLocaleString("en-GB")}{" "}
                characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {props.error}
        <ActionBar>
          <Button variant="outline" onClick={props.onCancel} disabled={props.busy} className="lg:order-2">
            Cancel
          </Button>
          <Button type="submit" disabled={tooShort || props.busy} aria-busy={props.busy}>
            {props.busy ? "Adding…" : "Add text"}
          </Button>
        </ActionBar>
      </form>
    </Form>
  );
}
