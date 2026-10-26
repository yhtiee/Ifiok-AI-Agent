import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Static on purpose: no pulse (motion only answers an action, 07 §3.4).
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" aria-hidden="true" className={cn("rounded-[6px] bg-line/60", className)} {...props} />
  );
}

export { Skeleton };
