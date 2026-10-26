import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Breadcrumb (desktop page header). Links are rendered by the caller (next/link).

function Breadcrumb(props: ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol data-slot="breadcrumb-list" className={cn("flex min-w-0 items-center gap-1 text-base", className)} {...props} />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("flex min-w-0 items-center gap-1", className)} {...props} />;
}

function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("truncate font-semibold", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator() {
  return (
    <li role="presentation" aria-hidden="true" className="flex shrink-0 items-center text-ink-3">
      <CaretRightIcon size={14} />
    </li>
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };
