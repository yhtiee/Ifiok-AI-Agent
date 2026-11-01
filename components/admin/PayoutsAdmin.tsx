"use client";

import type { CustomCellRendererProps } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SANDBOX_LABEL, usd } from "@/lib/payments/money";
import { useClosePeriod, usePeriodAction, useSendPayouts } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";
import { AdminGrid, type ColDef } from "./AdminGrid";

// Contributor payouts for the admin (10 MVP-07, 06 §3): close a month (the sandbox-funded pool is
// split by usage points with the 20% cap, in SQL), send it as one PayPal batch, read the items'
// status back from PayPal, and retry failed ones. Every number comes from the payout tables.

export type PeriodRow = {
  id: string;
  month: string;
  poolCents: number;
  splitCents: number;
  carriedCents: number;
  totalPoints: number;
  status: string;
  attempt: number;
  lines: { id: string; name: string; points: number; amountCents: number; capped: boolean; status: string }[];
};
type LineRow = PeriodRow["lines"][number] & { month: string };

const LINE_WORDS: Record<string, string> = {
  pending: "Ready",
  no_account: "No PayPal email",
  sent: "Sent",
  paid: "Paid",
  unclaimed: "Unclaimed",
  failed: "Failed",
  returned: "Returned",
};
const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");
export const monthName = (m: string) =>
  new Date(`${m}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function PayoutsAdmin(props: {
  month: string;
  demoPoolCents: number;
  periods: PeriodRow[];
  paypalReady: boolean;
}) {
  const router = useRouter();
  const ids = { month: useId(), pool: useId() };
  const close = useClosePeriod();
  const send = useSendPayouts();
  const act = usePeriodAction();
  const [month, setMonth] = useState(props.month);
  const [pool, setPool] = useState((props.demoPoolCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const busy = close.isPending || send.isPending || act.isPending;
  const done = (msg: string) => {
    toast(msg);
    router.refresh();
  };
  const fail = (err: unknown) => setError(errorText(err));

  const periodColumns = useMemo<ColDef<PeriodRow>[]>(
    () => [
      { headerName: "Month", field: "month", valueFormatter: (p) => monthName(p.value as string), minWidth: 150 },
      { headerName: "Pool", field: "poolCents", valueFormatter: (p) => usd(p.value as number), type: "numericColumn" },
      {
        headerName: "Shared",
        field: "splitCents",
        valueFormatter: (p) => usd(p.value as number),
        type: "numericColumn",
      },
      {
        headerName: "Stays in pool",
        field: "carriedCents",
        valueFormatter: (p) => usd(p.value as number),
        type: "numericColumn",
      },
      { headerName: "Points", field: "totalPoints", type: "numericColumn", maxWidth: 120 },
      {
        headerName: "Status",
        field: "status",
        valueFormatter: (p) => (p.value === "sent" ? "Sent to PayPal" : "Closed, not sent"),
      },
      {
        headerName: "Actions",
        colId: "actions",
        sortable: false,
        filter: false,
        minWidth: 300,
        cellRenderer: (p: CustomCellRendererProps<PeriodRow>) => {
          const row = p.data!;
          const failed = row.lines.some((l) => ["failed", "returned", "unclaimed"].includes(l.status));
          return (
            <span className="flex h-full items-center gap-2">
              {row.status === "computed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !props.paypalReady}
                  aria-label={`Send payouts for ${monthName(row.month)}`}
                  onClick={() => {
                    setError(null);
                    send.mutate(row.id, {
                      onSuccess: (r) =>
                        done(
                          `Sent ${r.sent} payouts to PayPal.${r.waiting ? ` ${r.waiting} wait for a PayPal email.` : ""}`,
                        ),
                      onError: fail,
                    });
                  }}
                >
                  Send payouts
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || !props.paypalReady}
                  aria-label={`Check PayPal for ${monthName(row.month)}`}
                  onClick={() =>
                    act.mutate(
                      { periodId: row.id, action: "refresh" },
                      { onSuccess: (r) => done(`Checked PayPal: ${r.changed ?? 0} updated.`), onError: fail },
                    )
                  }
                >
                  Check PayPal
                </Button>
              )}
              {row.status === "sent" && failed ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Retry failed payouts for ${monthName(row.month)}`}
                  onClick={() =>
                    act.mutate(
                      { periodId: row.id, action: "retry" },
                      {
                        onSuccess: (r) => done(`${r.reopened ?? 0} failed payouts are ready to send again.`),
                        onError: fail,
                      },
                    )
                  }
                >
                  Retry failed
                </Button>
              ) : null}
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the renderers read the latest state on render
    [busy, props.paypalReady],
  );

  const lineColumns = useMemo<ColDef<LineRow>[]>(
    () => [
      { headerName: "Month", field: "month", valueFormatter: (p) => monthName(p.value as string), minWidth: 150 },
      { headerName: "Contributor", field: "name", minWidth: 150 },
      { headerName: "Points", field: "points", type: "numericColumn", maxWidth: 120 },
      {
        headerName: "Amount",
        field: "amountCents",
        valueFormatter: (p) => usd(p.value as number),
        type: "numericColumn",
      },
      // Text, not AG Grid's boolean checkbox: the word says it (colour or a tick alone never does).
      { headerName: "20% cap", colId: "capped", valueGetter: (p) => (p.data?.capped ? "Capped" : ""), maxWidth: 130 },
      {
        headerName: "Status",
        field: "status",
        valueFormatter: (p) => LINE_WORDS[p.value as string] ?? (p.value as string),
      },
    ],
    [],
  );
  const lines = useMemo<LineRow[]>(
    () => props.periods.flatMap((p) => p.lines.map((l) => ({ ...l, month: p.month }))),
    [props.periods],
  );

  return (
    <div className="grid gap-8">
      <p className="text-sm font-semibold text-quantity">{SANDBOX_LABEL}</p>
      {props.paypalReady ? null : (
        <p className="text-sm text-bad">
          PayPal isn&apos;t connected: set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_ENV.
        </p>
      )}
      <form
        aria-label="Close a month"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          close.mutate(
            { month, pool_cents: Math.round(Number(pool) * 100) },
            { onSuccess: () => done("Month closed. Check the lines, then send."), onError: fail },
          );
        }}
      >
        <label htmlFor={ids.month} className="grid gap-1">
          <span className="text-sm font-semibold">Month</span>
          <Input
            id={ids.month}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </label>
        <label htmlFor={ids.pool} className="grid gap-1">
          <span className="text-sm font-semibold">Pool (USD, sandbox)</span>
          <Input
            id={ids.pool}
            inputMode="decimal"
            value={pool}
            onChange={(e) => setPool(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-32"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {close.isPending ? "Closing…" : "Close month"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="months" className="grid gap-3">
        <SectionHeading id="months">Months</SectionHeading>
        <p className="text-sm text-ink-2">
          Each contributor gets pool × their points ÷ all points, at most 20% of the pool; the rest stays in the pool.
        </p>
        <AdminGrid
          label="Payout months"
          rows={props.periods}
          columns={periodColumns}
          getRowId={(r) => r.id}
          height={280}
        />
      </section>

      <section aria-labelledby="lines" className="grid gap-3">
        <SectionHeading id="lines">Payout lines</SectionHeading>
        <AdminGrid label="Payout lines" rows={lines} columns={lineColumns} getRowId={(r) => r.id} />
      </section>
    </div>
  );
}
