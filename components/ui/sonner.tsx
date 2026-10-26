"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// One Toaster for the signed-in app (app/(app)/layout.tsx): bottom-centre, above the phone tab bar,
// flat (no shadow, no colour coding). Toasts reuse the verb ("Outline saved") and never carry
// prompt or tutor content. Sonner announces them through its own live region.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      richColors={false}
      closeButton={false}
      offset={24}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-[12px] border border-line bg-surface px-4 py-3 font-sans text-base text-ink shadow-none",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
