import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Wordmark } from "@/components/marketing/Brand";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

// Every signed-in page: a fixed header, the page title, then the content (app-overhaul §3.1).
// Phones show the back button and this page's name; desktop shows breadcrumbs with real names
// (Courses › MTH 101) from the first paint. Me lives in the tab bar and the sidebar, not here.

export type Crumb = { label: string; href?: string };

type AppPageProps = {
  /** Trail from the section down to this page; the last item is this page. */
  crumbs: Crumb[];
  title: ReactNode;
  /** Small line above the title, sentence case (e.g. the date or the university). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Controls beside the title (e.g. the course overflow menu). */
  actions?: ReactNode;
  /** Controls at the right of the fixed header (e.g. the lesson overflow menu). */
  headerActions?: ReactNode;
  /** Narrower content for forms and reading (left-aligned, never centred). */
  width?: "full" | "form" | "reading";
  children: ReactNode;
};

export function AppPage({
  crumbs,
  title,
  eyebrow,
  description,
  actions,
  headerActions,
  width = "full",
  children,
}: AppPageProps) {
  const parent = crumbs.length > 1 ? [...crumbs.slice(0, -1)].reverse().find((c) => c.href) : undefined;
  const current = crumbs.at(-1)?.label ?? "";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface print:hidden">
        <div className="flex h-14 items-center gap-2 px-2 sm:px-4 lg:h-16 lg:px-8">
          {parent ? (
            <Link
              href={parent.href!}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper lg:hidden"
              aria-label={`Back to ${parent.label}`}
            >
              <ArrowLeftIcon size={22} aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/today" className="flex min-h-11 items-center px-2 lg:hidden" aria-label="Ifiok, go to Today">
              <Wordmark className="text-[1.5rem]" />
            </Link>
          )}

          {parent ? (
            <p className="min-w-0 flex-1 truncate text-base font-semibold lg:hidden" aria-hidden="true">
              {current}
            </p>
          ) : (
            <span className="flex-1 lg:hidden" />
          )}

          <Breadcrumb className="hidden min-w-0 flex-1 lg:block">
            <BreadcrumbList>
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${i}`}>
                    <BreadcrumbItem>
                      {last ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : crumb.href ? (
                        <Link href={crumb.href} className="truncate text-ink-2 hover:text-ink hover:underline">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="truncate text-ink-2">{crumb.label}</span>
                      )}
                    </BreadcrumbItem>
                    {last ? null : <BreadcrumbSeparator />}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {headerActions ? <div className="flex shrink-0 items-center">{headerActions}</div> : null}
        </div>
      </header>

      <div className="w-full px-4 pt-5 pb-6 has-[[data-action-bar]]:pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:has-[[data-action-bar]]:pb-6">
        <div className={cn(width === "full" ? "max-w-[90rem]" : width === "form" ? "max-w-2xl" : "max-w-[46rem]")}>
          <div className="mb-6 flex items-start justify-between gap-3 lg:mb-8">
            <div className="min-w-0">
              {eyebrow ? <p className="text-sm text-ink-2">{eyebrow}</p> : null}
              <h1 className="font-display text-[1.75rem] leading-tight font-semibold [overflow-wrap:anywhere] lg:text-[2rem]">
                {title}
              </h1>
              {description ? <p className="mt-1 max-w-[60ch] text-base text-ink-2">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
