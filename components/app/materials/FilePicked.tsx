"use client";

import { FileIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { prepareFile, PrepareError, type PreparedFile } from "@/lib/materials/prepare";
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";

// A picked file (12 §4 Q60), read on the phone before it uploads: what Ifiok could read now, what
// it reads after upload (photos, scanned pages), and the one button that sends it.

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;

/** What Ifiok will do with the file, in words. */
export function describePrepared(p: PreparedFile): string {
  if (p.file.mime.startsWith("image/")) return "A photo. Ifiok reads it once it's uploaded.";
  const read = p.pages.length;
  return [
    read ? `${read} ${read === 1 ? "page" : "pages"} of text read on your phone.` : null,
    p.ocr.length
      ? `${p.ocr.length} scanned ${p.ocr.length === 1 ? "page" : "pages"} will be read once it's uploaded.`
      : null,
    p.unreadPages
      ? `The last ${p.unreadPages} pages are stored but not read (Ifiok reads up to ${MATERIAL_LIMITS.maxReadPages}).`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function FilePicked(props: {
  file: File;
  busy: boolean;
  confirmLabel: string;
  busyLabel: string;
  /** Disables the button (e.g. until a box is ticked). */
  blocked?: boolean;
  onConfirm: (prepared: PreparedFile) => void;
  onCancel: () => void;
}) {
  const { file } = props;
  const [state, setState] = useState<{ file: File; prepared?: PreparedFile; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    prepareFile(file)
      .then((prepared) => alive && setState({ file, prepared }))
      .catch(
        (err: unknown) =>
          alive &&
          setState({ file, error: err instanceof PrepareError ? err.message : "Ifiok couldn't open that file." }),
      );
    return () => {
      alive = false;
    };
  }, [file]);

  const current = state?.file === file ? state : null;
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <FileIcon size={28} className="mt-0.5 shrink-0 text-quantity" aria-hidden="true" />
        <div className="grid min-w-0 gap-1">
          <span className="text-base font-semibold [overflow-wrap:anywhere]">{file.name}</span>
          <span className="text-sm text-ink-2">{mb(file.size)}</span>
          {!current ? (
            <span className="grid gap-1" aria-busy="true" aria-label="Reading the file">
              <Skeleton className="h-4 w-56" />
            </span>
          ) : current.error ? (
            <span role="alert" className="text-base text-bad">
              {current.error}
            </span>
          ) : (
            <span className="text-sm text-ink-2">{describePrepared(current.prepared!)}</span>
          )}
        </div>
      </div>
      <ActionBar>
        <Button variant="outline" onClick={props.onCancel} disabled={props.busy} className="lg:order-2">
          {current?.error ? "Choose another file" : "Cancel"}
        </Button>
        <Button
          onClick={() => current?.prepared && props.onConfirm(current.prepared)}
          disabled={!current?.prepared || props.busy || props.blocked}
          aria-busy={props.busy}
        >
          {props.busy ? props.busyLabel : props.confirmLabel}
        </Button>
      </ActionBar>
    </div>
  );
}
