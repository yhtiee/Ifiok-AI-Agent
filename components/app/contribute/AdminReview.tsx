"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/Page";
import { ExplainerCard, type ExplainerCardView } from "@/components/app/explainers/ExplainerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminDecision } from "@/lib/queries/contribute";
import { ApiError } from "@/lib/query/api";

// The admin section (12 §4 Q58): four short queues, never the main gate. To review: what the
// checks held and new authors' first explainers. Reported: hidden after 3 student reports. Shares:
// material the checks held. Spot checks: a few auto-published explainers, to keep the checks honest.

type Item = ExplainerCardView & {
  status: string;
  issues: string[];
  reports: string[];
  concept: { id: string; title: string };
};
export type AdminQueue = {
  review: Item[];
  reported: Item[];
  spotChecks: Item[];
  shares: { id: string; title: string; kind: string; reason: string | null; owner: string; createdAt: string }[];
};

export function AdminReview({ queue, math }: { queue: AdminQueue; math: Record<string, string> }) {
  const counts = {
    review: queue.review.length,
    reported: queue.reported.length,
    shares: queue.shares.length,
    spot: queue.spotChecks.length,
  };
  return (
    <Tabs defaultValue="review">
      <TabsList aria-label="Admin queues">
        <TabsTrigger value="review">To review ({counts.review})</TabsTrigger>
        <TabsTrigger value="reported">Reported ({counts.reported})</TabsTrigger>
        <TabsTrigger value="shares">Shares ({counts.shares})</TabsTrigger>
        <TabsTrigger value="spot">Spot checks ({counts.spot})</TabsTrigger>
      </TabsList>
      <TabsContent value="review">
        <Explainers
          items={queue.review}
          math={math}
          empty="Nothing waiting. New authors' first explainers and anything the checks flag appear here."
          actions={["approve", "reject"]}
        />
      </TabsContent>
      <TabsContent value="reported">
        <Explainers
          items={queue.reported}
          math={math}
          empty="Nothing reported. Explainers hidden after 3 student reports appear here."
          actions={["approve", "reject"]}
          approveLabel="Restore"
        />
      </TabsContent>
      <TabsContent value="shares">
        {queue.shares.length ? (
          <div className="grid max-w-4xl gap-4">
            {queue.shares.map((s) => (
              <div key={s.id} className="grid gap-2 border-t border-line pt-4">
                <Link href={`/library/doc/${s.id}`} className="text-base font-semibold text-quantity hover:underline">
                  {s.title}
                </Link>
                <p className="text-sm text-ink-2">
                  {s.owner} · {s.kind.replace("_", " ")} · {s.reason ?? "Held for a person"}
                </p>
                <Decide target="shares" id={s.id} label={s.title} actions={["approve", "reject"]} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No held shares" body="Shared material the checks held for a person appears here." />
        )}
      </TabsContent>
      <TabsContent value="spot">
        <Explainers
          items={queue.spotChecks}
          math={math}
          empty="Nothing to spot-check. A few explainers that published automatically appear here."
          actions={["keep", "reject"]}
          rejectLabel="Take down"
        />
      </TabsContent>
    </Tabs>
  );
}

function Explainers(props: {
  items: Item[];
  math: Record<string, string>;
  empty: string;
  actions: ("approve" | "keep" | "reject")[];
  approveLabel?: string;
  rejectLabel?: string;
}) {
  if (!props.items.length) return <EmptyState title="All clear" body={props.empty} />;
  return (
    <div className="grid max-w-4xl grid-cols-1 gap-8">
      {props.items.map((e) => (
        <div key={e.id} className="grid grid-cols-1 gap-3">
          <p className="text-sm text-ink-2">
            {e.concept.title}
            {e.status === "held" ? " · Held by the checks" : e.status === "pending_admin" ? " · Passed the checks" : ""}
          </p>
          <ExplainerCard ex={e} math={props.math} reportable={false} />
          {e.reports.length ? (
            <div className="grid gap-1 text-sm">
              <p className="font-semibold">Reports</p>
              <ul className="grid list-disc gap-1 pl-5">
                {e.reports.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {e.issues.length ? (
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              {e.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">The AI checks found no issues.</p>
          )}
          <Decide
            target="explainers"
            id={e.id}
            label={e.title}
            actions={props.actions}
            approveLabel={props.approveLabel}
            rejectLabel={props.rejectLabel}
          />
        </div>
      ))}
    </div>
  );
}

const LABEL = { approve: "Approve", keep: "Looks fine", reject: "Reject" } as const;

function Decide(props: {
  target: "explainers" | "shares";
  id: string;
  label: string;
  actions: ("approve" | "keep" | "reject")[];
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const router = useRouter();
  const decide = useAdminDecision();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const go = (decision: "approve" | "keep" | "reject") =>
    decide.mutate(
      { target: props.target, id: props.id, decision, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast(`${decision === "reject" ? "Rejected" : decision === "keep" ? "Kept" : "Approved"}: ${props.label}`);
          router.refresh();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "That didn't save. Try again."),
      },
    );
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {props.actions.includes("reject") ? (
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, shown to the student if you reject"
            aria-label={`Reason for ${props.label}`}
            className="max-w-sm flex-1"
          />
        ) : null}
        {props.actions.map((a) => (
          <Button
            key={a}
            variant={a === "reject" ? "ghost" : "outline"}
            disabled={decide.isPending}
            onClick={() => go(a)}
          >
            {a === "approve"
              ? (props.approveLabel ?? LABEL.approve)
              : a === "reject"
                ? (props.rejectLabel ?? LABEL.reject)
                : LABEL.keep}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
