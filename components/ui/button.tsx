import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-styles";

// shadcn/ui Button. `asChild` renders the styles on a child, e.g. <Button asChild><Link/></Button>.
// Server-safe (no hooks); SubmitButton (useFormStatus) lives in submit-button.tsx.

export type ButtonProps = ComponentProps<"button"> & ButtonVariantProps & { asChild?: boolean };

function Button({ className, variant, size, full, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
