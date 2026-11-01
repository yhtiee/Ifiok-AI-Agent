"use client";

import type { CustomCellRendererProps } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sessionTime } from "@/lib/payments/booking-words";
import { SANDBOX_LABEL } from "@/lib/payments/money";
import { useResolveBooking } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";
import { AdminGrid, type ColDef } from "./AdminGrid";

// Tutoring bookings for the admin (F17, 06 §12, 10 MVP-07): every booking and where its money is,
// filterable by status; a disputed one is decided here (pay the tutor, or refund the learner).
// Admins see the booking record, never the two people's messages (guardrail 10).

export type BookingRow = {
  id: string;
  createdAt: string;
  concept: { title: string };
  learner: string;
  tutor: string;
  startsAt: string;
  price: string;
  commission: string;
  status: string;
  proposedBy: string;
  tutorPayout: string | null;
  note: string | null;
};

const STATUS: Record<string, string> = {
  awaiting_payment: "Waiting for PayPal approval",
  authorized: "Held",
  captured: "Taken, tutor not yet paid",
  paid_out: "Paid to tutor",
  voided: "Hold cancelled",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export function TutoringAdmin({ rows }: { rows: BookingRow[] }) {
  const router = useRouter();
  const resolve = useResolveBooking();
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo<ColDef<BookingRow>[]>(
    () => [
      {
        headerName: "Booked",
        field: "createdAt",
        valueFormatter: (p) => sessionTime(p.value as string),
        minWidth: 150,
        sort: "desc",
      },
      { headerName: "Topic", valueGetter: (p) => p.data?.concept.title, minWidth: 180 },
      { headerName: "Learner", field: "learner" },
      { headerName: "Tutor", field: "tutor" },
      {
        headerName: "Session",
        field: "startsAt",
        valueFormatter: (p) => sessionTime(p.value as string),
        minWidth: 150,
      },
      { headerName: "Price", field: "price", maxWidth: 120 },
      { headerName: "Commission", field: "commission", maxWidth: 140 },
      {
        headerName: "Status",
        field: "status",
        valueFormatter: (p) => STATUS[p.value as string] ?? (p.value as string),
        minWidth: 170,
      },
      {
        headerName: "Booked by",
        field: "proposedBy",
        valueFormatter: (p) => (p.value === "agent" ? "Ifiok agent, learner approved" : "Learner"),
        minWidth: 190,
      },
      { headerName: "Tutor payout", field: "tutorPayout", valueFormatter: (p) => (p.value as string | null) ?? "" },
      { headerName: "Note", field: "note", minWidth: 200 },
      {
        headerName: "Decide",
        colId: "decide",
        sortable: false,
        filter: false,
        minWidth: 280,
        cellRenderer: (p: CustomCellRendererProps<BookingRow>) =>
          p.data?.status === "disputed" ? (
            <span className="flex h-full items-center gap-2">
              {(["release", "refund"] as const).map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant="outline"
                  disabled={resolve.isPending}
                  onClick={() => {
                    setError(null);
                    resolve.mutate(
                      { id: p.data!.id, outcome },
                      {
                        onSuccess: () => {
                          toast(outcome === "release" ? "Paid to the tutor." : "Refunded the learner.");
                          router.refresh();
                        },
                        onError: (err) =>
                          setError(err instanceof ApiError ? err.message : "That didn't work. Try again."),
                      },
                    );
                  }}
                >
                  {outcome === "release" ? "Pay the tutor" : "Refund the learner"}
                </Button>
              ))}
            </span>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the renderer reads the latest state on render
    [resolve.isPending],
  );

  const disputed = rows.filter((r) => r.status === "disputed").length;
  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-quantity">{SANDBOX_LABEL}</p>
      <p className="text-base">
        {rows.length} {rows.length === 1 ? "booking" : "bookings"}
        {disputed ? `, ${disputed} disputed and waiting for you` : ", none disputed"}.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <AdminGrid label="Tutoring bookings" rows={rows} columns={columns} getRowId={(r) => r.id} height={560} />
    </div>
  );
}
