"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

// shadcn/ui Command, used inline (never in a dialog) with results from the server
// (`shouldFilter={false}`). Results are RowList-style rows: 56 px, divided by --line.

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("grid gap-3 text-ink", className)} {...props} />;
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="relative">
      <MagnifyingGlassIcon
        size={20}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2"
        aria-hidden="true"
      />
      <CommandPrimitive.Input data-slot="command-input" className={cn(fieldClass, "pl-10", className)} {...props} />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("overflow-hidden rounded-[12px] border border-line bg-surface empty:hidden", className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "border-b border-line last:border-b-0 [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-ink-2 [&_[cmdk-group-items]]:divide-y [&_[cmdk-group-items]]:divide-line",
        className,
      )}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 outline-hidden select-none data-[disabled=true]:cursor-wait data-[selected=true]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export { Command, CommandGroup, CommandInput, CommandItem, CommandList };
