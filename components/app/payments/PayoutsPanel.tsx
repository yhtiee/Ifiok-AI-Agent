"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SANDBOX_LABEL, usd } from "@/lib/payments/money";
import { useExplainPayout, useSavePayoutAccount } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";

// Payouts on My earnings (10 MVP-07): the PayPal (sandbox) email Ifiok pays you at, and each
// month's line from the contribution pool, with "Why this amount" explained in plain words.

export type PayoutLine = {
  id: string;
  month: string;
  points: number;
  amountCents: number;
  capped: boolean;
  status: string;
  explanation: string | null;
};

const STATUS: Record<string, { text: string; tone?: string }> = {
  pending: { text: "Ready to send" },
  no_account: { text: "Waiting for your PayPal email", tone: "text-bad" },
  sent: { text: "Sent, waiting for PayPal" },
  paid: { text: "Paid", tone: "text-built" },
  unclaimed: { text: "Unclaimed: check the email matches your PayPal account", tone: "text-bad" },
  failed: { text: "PayPal couldn't pay this", tone: "text-bad" },
  returned: { text: "Returned by PayPal", tone: "text-bad" },
};

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");
const monthName = (m: string) =>
  m ? new Date(`${m}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";

export function PayoutsPanel({ email, lines }: { email: string | null; lines: PayoutLine[] }) {
  const router = useRouter();
  const id = useId();
  const save = useSavePayoutAccount();
  const [value, setValue] = useState(email ?? "");
  const [editing, setEditing] = useState(!email);
  const [error, setError] = useState<string | null>(null);

  const submit = (next: string | null) => {
    setError(null);
    save.mutate(next, {
      onSuccess: () => {
        toast(next ? "Saved. Ifiok pays you at this PayPal account." : "Removed your PayPal email.");
        setEditing(!next);
        router.refresh();
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <section aria-labelledby="payouts" className="grid gap-4">
      <div className="grid gap-1">
        <SectionHeading id="payouts">Payouts</SectionHeading>
        <p className="text-sm font-semibold text-quantity">{SANDBOX_LABEL}</p>
      </div>
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(value.trim());
          }}
        >
          <label htmlFor={id} className="text-base font-semibold">
            Your PayPal email
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="you@personal.example.com"
              className="max-w-80"
            />
            <Button type="submit" variant="outline" disabled={save.isPending || !value.includes("@")}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-sm text-ink-2">
            Use a PayPal sandbox account. It&apos;s used only to pay you, never shown to anyone or sent to the AI.
          </p>
        </form>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 text-base">
          <span>
            Paid to <span className="font-semibold">{email}</span>
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 items-center font-semibold text-quantity underline-offset-4 hover:underline"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => submit(null)}
            className="inline-flex min-h-11 items-center text-ink-2 underline-offset-4 hover:underline"
          >
            Remove
          </button>
        </p>
      )}
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}

      {lines.length ? (
        <ul aria-label="Your payouts" className="divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <PayoutRow key={l.id} line={l} />
          ))}
        </ul>
      ) : (
        <p className="text-base text-ink-2">
          No payouts yet. Each month&apos;s pool is shared by usage points once the month closes.
        </p>
      )}
    </section>
  );
}

function PayoutRow({ line }: { line: PayoutLine }) {
  const explain = useExplainPayout();
  const [text, setText] = useState(line.explanation);
  const status = STATUS[line.status] ?? { text: line.status };
  return (
    <li className="grid gap-1 py-3">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base font-semibold">{monthName(line.month)}</span>
        <span className="font-display text-xl font-semibold text-built tabular-nums">{usd(line.amountCents)}</span>
      </span>
      <span className="text-sm text-ink-2">
        {line.points} {line.points === 1 ? "point" : "points"}
        {line.capped ? " · 20% cap" : ""} · <span className={status.tone}>{status.text}</span>
      </span>
      {text ? (
        <p className="text-base">{text}</p>
      ) : (
        <button
          type="button"
          disabled={explain.isPending}
          aria-busy={explain.isPending}
          onClick={() => explain.mutate(line.id, { onSuccess: (r) => setText(r.text) })}
          className="inline-flex min-h-11 items-center justify-self-start text-base font-semibold text-quantity underline-offset-4 hover:underline disabled:opacity-70"
        >
          {explain.isPending ? "Working it out…" : "Why this amount?"}
        </button>
      )}
      {explain.isError ? (
        <p role="alert" className="text-sm text-bad">
          {errorText(explain.error)}
        </p>
      ) : null}
    </li>
  );
}
