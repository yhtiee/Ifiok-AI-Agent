import {
  BookOpenTextIcon,
  ChatTeardropTextIcon,
  ExamIcon,
  FileTextIcon,
  FlaskIcon,
  MicrophoneIcon,
  NotebookIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { LibraryItem } from "@/lib/contribute/library";

// The Library grid (12 §4 Q58, Q59): every item together, newest first, YouTube-style: a picture,
// a title, who made it, and what it is. Explainers open on their watch page, documents in the
// document viewer. Plain thumbnails and text: no boxes, borders or shadows (owner decision over
// 07 §3.4's "no identical card grids").

const MASTERY_WORDS: Record<string, string> = { familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };
export const KIND_WORDS = {
  video: "Video",
  voice: "Voice note",
  text: "Written",
  notes: "Notes",
  lab_manual: "Lab manual",
  solution: "Worked solutions",
  past_paper: "Past questions",
} as const;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Placeholder({ item }: { item: LibraryItem }) {
  const Icon =
    item.type === "explainer"
      ? item.format === "voice"
        ? MicrophoneIcon
        : ChatTeardropTextIcon
      : item.kind === "lab_manual"
        ? FlaskIcon
        : item.kind === "past_paper"
          ? ExamIcon
          : item.kind === "solution"
            ? BookOpenTextIcon
            : NotebookIcon;
  return (
    <span className="flex h-full w-full items-center justify-center text-quantity" aria-hidden="true">
      <Icon size={40} />
    </span>
  );
}

export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  return (
    <ul aria-label="Library" className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const href = item.type === "explainer" ? `/library/${item.id}` : `/library/doc/${item.id}`;
        const kind = item.type === "explainer" ? KIND_WORDS[item.format] : KIND_WORDS[item.kind];
        const badge =
          item.type === "explainer"
            ? item.durationS
              ? clock(item.durationS)
              : "Read"
            : `${item.pages} ${item.pages === 1 ? "page" : "pages"}`;
        return (
          <li key={`${item.type}:${item.id}`}>
            <Link href={href} className="group grid gap-2">
              <span
                className={`relative block aspect-video overflow-hidden rounded-[var(--radius-input)] ${
                  item.type === "doc" ? "bg-paper" : "bg-quantity-soft"
                }`}
              >
                {item.image ? (
                  // A small JPEG: a video's sampled frame or a document's first page, loaded lazily.
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not a static asset
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full ${item.type === "doc" ? "object-cover object-top" : "object-cover"}`}
                  />
                ) : item.type === "doc" ? (
                  <span className="flex h-full w-full items-center justify-center text-ink-2" aria-hidden="true">
                    <FileTextIcon size={40} />
                  </span>
                ) : (
                  <Placeholder item={item} />
                )}
                <span className="absolute right-2 bottom-2 rounded bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper tabular-nums">
                  {badge}
                </span>
              </span>
              <span className="grid gap-0.5">
                <span className="line-clamp-2 text-base font-semibold group-hover:underline">{item.title}</span>
                <span className="text-sm text-ink-2">
                  {item.author}
                  {item.mastery ? ` · ${MASTERY_WORDS[item.mastery]}` : ""}
                </span>
                <span className="text-sm text-ink-2">
                  {kind}
                  {item.concept ? ` · ${item.concept.title}` : ""}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
