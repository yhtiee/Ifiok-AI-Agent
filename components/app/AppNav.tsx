"use client";

import {
  BooksIcon,
  ExamIcon,
  FlaskIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SunHorizonIcon,
  UserCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Student navigation (app-overhaul §3.1, 12 §4 Q50, Q52, Q56, Q58): Today · Courses · Practice · Labs ·
// Library · Me, and Admin for admins. Nothing that isn't live is listed. Labs and Library are
// desktop-only: the phone tab bar keeps four items, and Practice links to both there.
export const NAV_ITEMS: { href: string; label: string; icon: Icon; phone: boolean }[] = [
  { href: "/today", label: "Today", icon: SunHorizonIcon, phone: true },
  { href: "/courses", label: "Courses", icon: BooksIcon, phone: true },
  { href: "/practice", label: "Practice", icon: ExamIcon, phone: true },
  { href: "/labs", label: "Labs", icon: FlaskIcon, phone: false },
  { href: "/library", label: "Library", icon: PlayCircleIcon, phone: false },
  { href: "/me", label: "Me", icon: UserCircleIcon, phone: true },
];

/** The lesson player, a practice session, a lab and a timed paper own the thumb zone, so the tab bar hides there. */
export const isFocusScreen = (pathname: string) =>
  pathname.startsWith("/learn/") ||
  pathname.startsWith("/labs/") ||
  /^\/practice\/[^/]+/.test(pathname) ||
  /\/exam\/paper$/.test(pathname);

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar links (lg+). Me lives in the sidebar footer; Admin shows only for admins. */
export function SidebarNav({ admin = false }: { admin?: boolean }) {
  const isActive = useIsActive();
  const items = [
    ...NAV_ITEMS.filter((item) => item.href !== "/me"),
    ...(admin ? [{ href: "/admin", label: "Admin", icon: ShieldCheckIcon, phone: false }] : []),
  ];
  return (
    <nav aria-label="Main" className="grid gap-1">
      {items.map(({ href, label, icon: IconCmp }) => {
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
  );
}

/** Phone bottom navigation (below lg). Fixed, thumb zone, 3 items, labels always visible. */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = useIsActive();
  if (isFocusScreen(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      {/* One row, one equal column per tab, however many tabs there are. */}
      <ul className="grid auto-cols-fr grid-flow-col">
        {NAV_ITEMS.filter((item) => item.phone).map(({ href, label, icon: IconCmp }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                  active ? "font-semibold text-quantity" : "text-ink-2"
                }`}
              >
                <IconCmp size={24} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Content area: leaves room for the tab bar on phones, except on focus screens. */
export function MainArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    // overflow-x-clip: a wide formula or diagram can never paint over the sidebar (clip, not hidden,
    // so sticky headers and action bars still work).
    <main
      className={`min-w-0 flex-1 overflow-x-clip lg:pb-10 ${isFocusScreen(pathname) ? "pb-0" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"}`}
    >
      {children}
    </main>
  );
}
