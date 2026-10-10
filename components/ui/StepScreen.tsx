import type { ReactNode } from "react";

// One idea per screen (00 §4.2): a short title, one line of context, the content and the one
// primary action. Phones: the action is pinned to the bottom (thumb zone, 07 §6) and a progress
// bar shows the step. Desktop: the layout's left panel shows the steps, so the bar is hidden and
// the action sits right under the content.

type StepScreenProps = {
  step?: { current: number; total: number };
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  /** The screen's primary action. */
  action?: ReactNode;
};

export function StepScreen({ step, title, intro, children, action }: StepScreenProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 pb-6 lg:flex-none">
        {step ? (
          <div className="mb-6 grid gap-2 lg:hidden">
            <p className="text-sm text-ink-2 tabular-nums">
              Step {step.current} of {step.total}
            </p>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={1}
              aria-valuemax={step.total}
              aria-valuenow={step.current}
              className="h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-built"
                style={{ width: `${(step.current / step.total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold lg:text-[2.25rem]">{title}</h1>
        {intro ? <div className="mt-2 max-w-[60ch] text-base text-ink-2 lg:text-lg">{intro}</div> : null}
        {children ? <div className="mt-6 lg:mt-8">{children}</div> : null}
      </div>
      {action ? (
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:max-w-sm sm:border-0 sm:px-0 sm:pb-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}
