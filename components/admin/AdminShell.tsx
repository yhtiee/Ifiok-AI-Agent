"use client";

import { ChalkboardTeacherIcon, CoinsIcon, ShieldCheckIcon, SignOutIcon, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/marketing/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

// The admin interface (12 §4 Q58, Q63): admins aren't students, so it has only admin work: the
// review queues, contributor payouts and tutoring bookings. Desktop: a left sidebar; phones: a
// bottom bar. No student navigation, learning or earning screens appear here.

const ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: "/admin", label: "Review", icon: ShieldCheckIcon },
  { href: "/admin/payouts", label: "Payouts", icon: CoinsIcon },
  { href: "/admin/tutoring", label: "Tutoring", icon: ChalkboardTeacherIcon },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ email, children }: { email: string | null; children: ReactNode }) {
  const isActive = useActive();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link href="/admin" className="flex min-h-11 items-center gap-2 px-3" aria-label="Ifiok admin, go to Review">
          <Wordmark className="text-[1.75rem]" />
          <span className="text-sm font-semibold text-ink-2">Admin</span>
        </Link>
        <nav aria-label="Admin" className="mt-6 grid flex-1 content-start gap-1">
          {ITEMS.map(({ href, label, icon: IconCmp }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-input)] px-3 text-base transition-colors ${
                  active ? "bg-quantity-soft font-semibold text-quantity" : "text-ink-2 hover:bg-paper hover:text-ink"
                }`}
              >
                <IconCmp size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="grid gap-1 border-t border-line pt-4">
          {email ? <span className="truncate px-3 text-xs text-ink-2">{email}</span> : null}
          <ThemeToggle
            withLabel
            className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-input)] px-3 text-sm text-ink-2 hover:bg-paper hover:text-ink"
          />
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-input)] px-3 text-sm text-ink-2 hover:bg-paper hover:text-ink"
            >
              <SignOutIcon size={20} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </main>

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {ITEMS.map(({ href, label, icon: IconCmp }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-semibold text-quantity" : "text-ink-2"
                  }`}
                >
                  <IconCmp size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <form action="/auth/sign-out" method="post" className="h-full">
              <button
                type="submit"
                className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs text-ink-2"
              >
                <SignOutIcon size={22} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </div>
  );
}
