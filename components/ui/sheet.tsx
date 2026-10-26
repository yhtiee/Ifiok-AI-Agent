"use client";

import { XIcon } from "@phosphor-icons/react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Sheet, bottom side only (the outline History on phones). The one raised surface: a top
// --line edge and a handle bar, no shadow, an ink overlay without blur. It rises unless the
// student asked for reduced motion (the global rule stops the animation).

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({ className, children, ...props }: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-ui-fade" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[85dvh] gap-3 overflow-y-auto rounded-t-[12px] border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink data-[state=open]:animate-ui-rise",
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        {children}
        <SheetPrimitive.Close
          className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-paper hover:text-ink"
          aria-label="Close"
        >
          <XIcon size={20} aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("pr-12 text-lg font-semibold", className)} {...props} />;
}

function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-ink-2", className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
