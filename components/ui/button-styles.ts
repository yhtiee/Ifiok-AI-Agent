import { cva, type VariantProps } from "class-variance-authority";

// Button styles, shared by server and client components: the shadcn/ui Button's cva, themed for
// Ifiok (07 §3.3: one camwood primary per screen, 999px radius, touch targets ≥ 44 px — buttons
// are 48 px — no shadows). Kept apart from button.tsx so server components can style links too.

export const buttonVariants = cva(
  "inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait aria-busy:opacity-90 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-change-hover",
        outline: "border border-ink/25 bg-surface text-ink hover:border-ink/50",
        ghost: "px-3 text-ink-2 underline-offset-4 hover:text-ink hover:underline",
        destructive: "border border-bad bg-transparent text-bad hover:bg-bad/10",
      },
      size: {
        default: "",
        sm: "min-h-11 px-4 text-sm",
        icon: "h-11 min-h-11 w-11 px-0",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", full: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
