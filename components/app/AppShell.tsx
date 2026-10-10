import { SignOutIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/marketing/Brand";
import { FEATURES } from "@/lib/features";
import { BottomNav, SidebarNav, SidebarTools } from "./AppNav";

const TOOLS = [
  { key: "tutor", label: "Ask Ifiok" },
  { key: "labs", label: "Labs" },
  { key: "snap", label: "Snap and mark" },
  { key: "library", label: "Library" },
] as const;

// The signed-in app frame (P0-06). Laptops and desktops: a fixed left sidebar and a content area
// that uses the full width beside it. Phones: full-width content (16 px gutters) and the bottom
// tab bar in the thumb zone. Every page adds a fixed header with back navigation (AppPage).

type AppShellProps = {
  user: { name: string; email: string | null };
  children: ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link href="/today" className="flex min-h-11 items-center px-3" aria-label="Ifiok, go to Today">
          <Wordmark className="text-[1.75rem]" />
        </Link>
        <div className="mt-6 grid flex-1 content-start gap-6 overflow-y-auto">
          <SidebarNav />
          <SidebarTools tools={TOOLS.map((t) => ({ ...t, href: FEATURES[t.key].href, open: FEATURES[t.key].open }))} />
        </div>
        <div className="grid gap-1 border-t border-line pt-4">
          <Link
            href="/me"
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-input)] px-3 hover:bg-paper"
          >
            <Avatar initial={initial} />
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
        {/* Each page (AppPage) renders its own fixed header with breadcrumbs and back navigation. */}
        <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-quantity-soft text-sm font-semibold text-quantity"
    >
      {initial}
    </span>
  );
}
