import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Progress, without the Radix primitive (a plain progressbar keeps the lesson shell
// small). Track --line, fill --quantity, 4 px; the width change is the only motion.
function Progress({ className, value = 0, ...props }: ComponentProps<"div"> & { value?: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-line", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-quantity transition-[width] duration-150"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
