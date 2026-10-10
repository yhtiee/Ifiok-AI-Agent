// Button styles, shared by server and client components (07 §3.3: one camwood primary per screen,
// 999px radius, touch targets ≥ 44px — we use 48px — no shadows). Kept out of Button.tsx, which
// is a client module, so server components can style links and form buttons too.
export type ButtonVariant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait aria-busy:opacity-90";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-change text-on-change hover:opacity-90",
  secondary: "border border-ink/25 bg-surface text-ink hover:border-ink/50",
  quiet: "px-3 text-ink-2 underline-offset-4 hover:text-ink hover:underline",
};

export function buttonClass(variant: ButtonVariant = "primary", full = false) {
  return `${base} ${variants[variant]} ${full ? "w-full" : ""}`;
}
