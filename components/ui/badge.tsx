import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Only for a label a sentence can't carry (today: "Draft"). Never for state text can say.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-line text-ink-2",
        draft: "border-dashed border-change text-change",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
