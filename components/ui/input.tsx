import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Input, themed (app-overhaul §6): 48 px, 6 px radius, a 3:1 edge, the global focus outline.
export const fieldClass =
  "min-h-12 w-full min-w-0 rounded-[6px] border border-input bg-surface px-3 text-base text-ink placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-bad";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, className)} {...props} />;
}

export { Input };
