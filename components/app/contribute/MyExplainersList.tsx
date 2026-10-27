"use client";

import { ChatTeardropTextIcon, MicrophoneIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { Row, RowList } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { useWithdrawExplainer } from "@/lib/queries/contribute";

// The author's explainers with their status (F18): being checked, waiting for a person, live, or
// not approved with the reason. Withdrawing hides it at once and deletes its media.

const STATUS: Record<string, string> = {
  uploading: "Upload didn't finish",
  processing: "Being checked",
  pending_admin: "Waiting for a person to approve it",
  held: "Waiting for a person to check it",
  approved: "Live: other students can see it",
  rejected: "Not approved",
};

export type MyExplainer = {
  id: string;
  title: string;
  kind: "text" | "voice" | "video";
  status: string;
  reason: string | null;
  concept: { id: string; title: string };
};

export function MyExplainersList({ items }: { items: MyExplainer[] }) {
  const router = useRouter();
  const withdraw = useWithdrawExplainer();
  return (
    <RowList label="Your explainers">
      {items.map((e) => (
        <Row
          key={e.id}
          href={e.status === "approved" ? `/explainers/${e.concept.id}` : undefined}
          icon={
            e.kind === "video" ? (
              <VideoCameraIcon size={22} />
            ) : e.kind === "voice" ? (
              <MicrophoneIcon size={22} />
            ) : (
              <ChatTeardropTextIcon size={22} />
            )
          }
          tone={e.status === "approved" ? "topic" : "plain"}
          title={e.title}
          meta={`${e.concept.title} · ${STATUS[e.status] ?? e.status}${e.reason && e.status === "rejected" ? `: ${e.reason}` : ""}`}
          trailing={
            <Button
              variant="ghost"
              size="sm"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate(e.id, { onSuccess: () => router.refresh() })}
            >
              Withdraw
            </Button>
          }
        />
      ))}
    </RowList>
  );
}
