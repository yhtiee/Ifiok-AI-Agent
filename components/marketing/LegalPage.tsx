import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./Brand";

// Plain-language legal pages (P1-13). Drafts until the owner's legal review (OWN-06).
// Desktop: a left page nav and the text beside it (text kept to a readable measure, 07 §3.3);
// phones: one column with the page links at the end.

const PAGES = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy notice" },
  { href: "/ai", label: "How Ifiok uses AI" },
];

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex min-h-11 items-center" aria-label="Ifiok home">
            <Wordmark className="text-[1.6rem]" />
          </Link>
          <Link href="/sign-in" className="min-h-11 py-3 text-sm font-semibold text-quantity hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <div className="flex-1 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:py-12">
        <nav aria-label="Legal" className="hidden lg:block">
          <ul className="sticky top-8 grid gap-1">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="flex min-h-11 items-center rounded-[var(--radius-input)] px-3 text-base text-ink-2 hover:bg-surface hover:text-ink"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main>
          <h1 className="font-display text-[2rem] leading-tight font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-ink-2">Draft, under legal review · Last updated {updated}</p>
          <div className="mt-8 grid max-w-[68ch] gap-8 text-base [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_section]:grid [&_section]:gap-3 [&_ul]:grid [&_ul]:gap-1.5">
            {children}
          </div>
          <nav
            aria-label="Legal pages"
            className="mt-12 flex flex-wrap gap-x-6 border-t border-line pt-6 text-sm lg:hidden"
          >
            {PAGES.map((p) => (
              <Link key={p.href} className="min-h-11 py-3 text-ink-2 hover:text-ink" href={p.href}>
                {p.label}
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}

export function ContactLine({ email, fallback }: { email: string | null; fallback: string }) {
  return email ? (
    <a className="font-semibold text-quantity underline underline-offset-4" href={`mailto:${email}`}>
      {email}
    </a>
  ) : (
    <>{fallback}</>
  );
}
