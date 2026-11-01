"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/app/Page";
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
import { Textarea } from "@/components/ui/textarea";
import { useBookingAction, type BookingAction } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";

// A booking's steps (F17-FR4, FR5, 10 MVP-07). Back from PayPal with approval, the hold is created
// once (a POST, never on render). The learner confirms (capture, tutor paid), reports a tutor
// no-show (void) or a problem (frozen for an admin); the tutor can report a problem too.

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");

export function BookingActions(props: {
  id: string;
  role: "learner" | "tutor";
  status: string;
  tutor: string;
  returned: "approved" | "cancelled" | null;
}) {
  const router = useRouter();
  const act = useBookingAction(props.id);
  const { mutate } = act;
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);

  const run = (body: BookingAction, done: string) => {
    setError(null);
    mutate(body, {
      onSuccess: () => {
        toast(done);
        router.replace(`/tutoring/${props.id}`);
        router.refresh();
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  // Back from PayPal: authorise the approved order (the hold) once.
  const authorize = props.role === "learner" && props.status === "awaiting_payment" && props.returned === "approved";
  useEffect(() => {
    if (!authorize || asked.current) return;
    asked.current = true;
    mutate(
      { action: "authorize" },
      {
        onSuccess: () => {
          toast("Booked. PayPal is holding the payment until the session.");
          router.replace(`/tutoring/${props.id}`);
          router.refresh();
        },
        onError: (err) => setError(errorText(err)),
      },
    );
  }, [authorize, mutate, props.id, router]);

  const errorLine = error ? (
    <p role="alert" className="text-base text-bad">
      {error}
    </p>
  ) : null;

  if (authorize && !error) return <p role="status">Holding the payment on PayPal…</p>;

  if (props.status === "awaiting_payment" && props.role === "learner")
    return (
      <div className="grid gap-3">
        {props.returned === "cancelled" ? (
          <p>You didn&apos;t approve the payment on PayPal, so nothing was booked.</p>
        ) : null}
        {errorLine}
        <ActionBar>
          <Button
            variant="outline"
            disabled={act.isPending}
            onClick={() => run({ action: "cancel" }, "Booking cancelled.")}
          >
            Cancel booking
          </Button>
        </ActionBar>
      </div>
    );

  if (props.status !== "authorized") return errorLine;

  return (
    <div className="grid gap-3">
      {errorLine}
      <ActionBar>
        {props.role === "learner" ? (
          <>
            <NoShow
              tutor={props.tutor}
              busy={act.isPending}
              onConfirm={() => run({ action: "no_show" }, "Cancelled. You weren't charged.")}
            />
            <Problem
              busy={act.isPending}
              onSend={(reason) => run({ action: "dispute", reason }, "Sent. An admin will look at it.")}
            />
            <Button
              disabled={act.isPending}
              aria-busy={act.isPending}
              onClick={() => run({ action: "confirm" }, `Thanks. ${props.tutor} is being paid.`)}
              className="lg:order-first"
            >
              {act.isPending ? "Working…" : "The session happened"}
            </Button>
          </>
        ) : (
          <Problem
            busy={act.isPending}
            onSend={(reason) => run({ action: "dispute", reason }, "Sent. An admin will look at it.")}
          />
        )}
      </ActionBar>
    </div>
  );
}

function NoShow(props: { tutor: string; busy: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={props.busy}>
          Tutor didn&apos;t show
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{props.tutor} didn&apos;t show up?</AlertDialogTitle>
        <AlertDialogDescription>
          Ifiok cancels the PayPal hold, so you aren&apos;t charged, and the tutor isn&apos;t paid.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction onClick={props.onConfirm}>Cancel the payment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Problem(props: { busy: boolean; onSend: (reason: string) => void }) {
  const id = useId();
  const [reason, setReason] = useState("");
  return (
    <AlertDialog onOpenChange={(open) => !open && setReason("")}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={props.busy}>
          Report a problem
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>What went wrong?</AlertDialogTitle>
        <AlertDialogDescription>
          The payment stays held while an admin reviews the booking. They see the booking, not your messages.
        </AlertDialogDescription>
        <label htmlFor={id} className="sr-only">
          What went wrong
        </label>
        <Textarea id={id} rows={3} maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction disabled={reason.trim().length < 5} onClick={() => props.onSend(reason.trim())}>
            Send to an admin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
