import { DocViewer, TextDocument } from "./DocViewer";

// A stored material in Ifiok's viewer (12 §4 Q59, Q60): a PDF drawn page by page, a photo as it is,
// or a Word document (and pasted text) as its text pages, with the original file to download.

export type StoredFileProps = {
  title: string;
  pdfUrl: string | null;
  imageUrl: string | null;
  fileUrl: string | null;
  fileMime: string | null;
  pages: { page: number | null; text: string }[];
};

export function StoredFile({ title, pdfUrl, imageUrl, fileUrl, fileMime, pages }: StoredFileProps) {
  if (pdfUrl) return <DocViewer url={pdfUrl} title={title} />;
  if (imageUrl)
    return (
      <div className="max-w-3xl overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset */}
        <img src={imageUrl} alt={title} className="block h-auto w-full" />
      </div>
    );
  const isWord = fileMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return (
    <div className="grid gap-3">
      {fileUrl && isWord ? (
        <a
          href={fileUrl}
          download
          className="inline-flex min-h-11 items-center justify-self-start text-base text-quantity underline-offset-4 hover:underline"
        >
          Download the Word file
        </a>
      ) : null}
      {pages.length ? (
        <TextDocument pages={pages} />
      ) : (
        <p className="text-base text-ink-2">Ifiok is still reading this. Check back in a few minutes.</p>
      )}
    </div>
  );
}
