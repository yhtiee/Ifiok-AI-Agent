import { ArrowLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/marketing/Brand";
import { greeting } from "@/lib/auth/names";
import { getViewer } from "@/lib/auth/viewer";

// Every signed-in page: a fixed header (back button + breadcrumbs, always visible while
// scrolling), the page title, then the content. Server-rendered, so breadcrumbs carry real names
// (Courses › MTH 101) from the first paint.

export type Crumb = { label: string; href?: string };

type AppPageProps = {
  /** Trail from the section down to this page; the last item is this page. */
  crumbs: Crumb[];
  title: ReactNode;
  /** Small line above the title, sentence case (e.g. the date or the university). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export async function AppPage({ crumbs, title, eyebrow, description, actions, children }: AppPageProps) {
  const viewer = await getViewer();
  const initial = (viewer?.profile.first_name || viewer?.email || "?").trim().charAt(0).toUpperCase();
  const hello = greeting(viewer?.profile.first_name);
  const parent = crumbs.length > 1 ? [...crumbs.slice(0, -1)].reverse().find((c) => c.href) : undefined;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex h-14 items-center gap-2 px-2 sm:px-4 lg:h-16 lg:px-8">
          {parent ? (
            <Link
              href={parent.href!}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper"
              aria-label={`Back to ${parent.label}`}
            >
              <ArrowLeftIcon size={22} aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/today" className="flex min-h-11 items-center px-2 lg:hidden" aria-label="Ifiok, go to Today">
              <Wordmark className="text-[1.5rem]" />
            </Link>
          )}

          <nav aria-label="Breadcrumb" className={`min-w-0 flex-1 ${parent ? "" : "hidden lg:block"}`}>
            <ol className="flex min-w-0 items-center gap-1 text-base">
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li
                    key={`${crumb.label}-${i}`}
                    className={`flex min-w-0 items-center gap-1 ${last ? "" : "hidden sm:flex"}`}
                  >
                    {last ? (
                      <span aria-current="page" className="truncate font-semibold">
                        {crumb.label}
                      </span>
                    ) : crumb.href ? (
                      <Link href={crumb.href} className="truncate text-ink-2 hover:text-ink hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate text-ink-2">{crumb.label}</span>
                    )}
                    {!last ? <CaretRightIcon size={14} className="shrink-0 text-ink-3" aria-hidden="true" /> : null}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Greeting: always on wider screens; on phones only where there's no back button and trail. */}
          <p
            className={`ml-auto min-w-0 truncate pl-2 text-base text-ink-2 ${parent ? "hidden sm:block" : ""}`}
            data-testid="greeting"
          >
            {hello}
          </p>
          <Link
            href="/me"
            aria-label="Me: your profile and settings"
            className="flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-quantity-soft text-sm font-semibold text-quantity"
            >
              {initial}
            </span>
          </Link>
        </div>
      </header>

      <div className="w-full max-w-[90rem] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
          <div className="min-w-0">
            {eyebrow ? <p className="text-sm text-ink-2">{eyebrow}</p> : null}
            <h1 className="font-display text-[1.75rem] leading-tight font-semibold lg:text-[2rem]">{title}</h1>
            {description ? <p className="mt-1 max-w-[60ch] text-base text-ink-2">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </>
  );
}
