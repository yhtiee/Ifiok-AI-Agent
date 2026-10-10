"use client";

import {
  BooksIcon,
  CameraIcon,
  ChatCircleTextIcon,
  FlaskIcon,
  FolderOpenIcon,
  SunHorizonIcon,
  TargetIcon,
  UserCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FeatureKey } from "@/lib/features";

// Student navigation (specifications/07-brand-ui-ux.md §4): Today · Courses · Practice · Me.
// Labs, the bank, the wallet and groups are reached from inside these.
export const NAV_ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: "/today", label: "Today", icon: SunHorizonIcon },
  { href: "/courses", label: "Courses", icon: BooksIcon },
  { href: "/practice", label: "Practice", icon: TargetIcon },
  { href: "/me", label: "Me", icon: UserCircleIcon },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar links (lg+). */
export function SidebarNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: IconCmp }) => {
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

/**
 * Desktop sidebar: learning tools reached from inside the main tabs on phones (07 §4).
 * Tools that aren't open yet are listed (so students see what's coming) but not linked.
 */
export function SidebarTools({ tools }: { tools: { key: FeatureKey; label: string; href: string; open: boolean }[] }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Learning tools" className="grid gap-1">
      <p className="px-3 pb-1 text-xs font-semibold text-ink-2">Learning tools</p>
      {tools.map(({ key, label, href, open }) => {
        const IconCmp = TOOL_ICONS[key] ?? FolderOpenIcon;
        if (!open) {
          return (
            <span
              key={key}
              aria-disabled="true"
              className="flex min-h-10 items-center gap-3 rounded-[var(--radius-input)] px-3 text-sm text-ink-3"
            >
              <IconCmp size={20} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="text-xs">Soon</span>
            </span>
          );
        }
        const active = isActive(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-[var(--radius-input)] px-3 text-sm ${
              active ? "bg-quantity-soft font-semibold text-quantity" : "text-ink-2 hover:bg-paper hover:text-ink"
            }`}
          >
            <IconCmp size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const TOOL_ICONS: Partial<Record<FeatureKey, Icon>> = {
  tutor: ChatCircleTextIcon,
  labs: FlaskIcon,
  snap: CameraIcon,
  library: FolderOpenIcon,
};

/** Phone bottom navigation (below lg). Fixed, thumb zone, 4 items, label always visible. */
export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: IconCmp }) => {
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
