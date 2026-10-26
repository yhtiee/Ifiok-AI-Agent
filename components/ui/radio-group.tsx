"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui RadioGroup. Options are full-width rows in a divided list (RadioGroupRow): the whole
// row is the touch target.

function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid", className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-2 bg-surface disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-quantity",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="size-2.5 rounded-full bg-quantity" />
    </RadioGroupPrimitive.Item>
  );
}

/** One option as a 56 px row: radio, label and an optional line under it. */
function RadioGroupRow({ value, label, detail }: { value: string; label: string; detail?: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-pointer items-center gap-3 bg-surface px-4 py-2 hover:bg-paper has-data-[state=checked]:bg-quantity-soft"
    >
      <RadioGroupItem value={value} id={id} />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {detail ? <span className="text-sm text-ink-2">{detail}</span> : null}
      </span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupRow };
