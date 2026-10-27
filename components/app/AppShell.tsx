import { SignOutIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/marketing/Brand";
import { BottomNav, MainArea, SidebarNav } from "./AppNav";

// The signed-in app frame (P0-06, app-overhaul §3.1). Laptops and desktops: a fixed left sidebar
// (Today, Courses, then the profile and Sign out at the foot) and a content area that uses the full
// width beside it. Phones: full-width content (16 px gutters) and the bottom tab bar in the thumb
// zone. Every page adds a fixed header with back navigation (AppPage).

type AppShellProps = {
  user: { name: string; email: string | null };
  /** Shows the Admin item in the sidebar (12 §4 Q58). */
  admin?: boolean;
  children: ReactNode;
};

export function AppShell({ user, admin = false, children }: AppShellProps) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex print:hidden">
        <Link href="/today" className="flex min-h-11 items-center px-3" aria-label="Ifiok, go to Today">
          <Wordmark className="text-[1.75rem]" />
        </Link>
        <div className="mt-6 flex-1">
          <SidebarNav admin={admin} />
        </div>
        <div className="grid gap-1 border-t border-line pt-4">
          <Link
            href="/me"
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-input)] px-3 hover:bg-paper"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-quantity-soft text-sm font-semibold text-quantity"
            >
              {initial}
            </span>
            <span className="grid min-w-0">
              <span className="truncate text-sm font-semibold">{user.name || "Your profile"}</span>
              {user.email ? <span className="truncate text-xs text-ink-2">{user.email}</span> : null}
            </span>
          </Link>
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

      <div className="flex min-w-0 flex-col">
        <MainArea>{children}</MainArea>
      </div>

      <BottomNav />
    </div>
  );
}
