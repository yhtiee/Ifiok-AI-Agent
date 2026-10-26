"use client";

import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { MathHtmlProvider, RichText } from "@/components/lesson/RichText";
import { Button } from "@/components/ui/button";
import { useWorkedSolution, type SolutionResponse } from "@/lib/queries/exam";
import { ApiError } from "@/lib/query/api";

// A past question's worked solution (10 MVP-04): generated the first time anyone in the course asks,
// then shared. The final number is "checked" only when Ifiok's maths engine computed the same value;
// otherwise it says so (guardrail 2). Maths arrives pre-rendered from the server.

export function WorkedSolutionView({ data }: { data: SolutionResponse }) {
  const { solution, math } = data;
  return (
    <MathHtmlProvider value={math}>
      <div className="grid grid-cols-1 gap-3 rounded-[var(--radius-input)] border border-line bg-surface p-4">
        <p className="text-xs text-ink-2">Worked solution · AI · can be wrong</p>
        <ol className="grid list-decimal grid-cols-1 gap-3 pl-5">
          {solution.steps.map((s, i) => (
            <li key={i} className="text-base leading-relaxed">
              <RichText text={s.text} />
              {s.latex && math[`display:${s.latex}`] ? (
                <div
                  className="mx-auto my-2 w-fit max-w-full overflow-x-auto"
                  // Our own KaTeX output (trust: false), rendered on the server.
                  dangerouslySetInnerHTML={{ __html: math[`display:${s.latex}`]! }}
                />
              ) : s.latex ? (
                <code className="mt-1 block text-sm break-all text-quantity">{s.latex}</code>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="border-t border-line pt-3">
          <p className="text-base font-semibold">
            <RichText text={solution.final.text} />
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${solution.checked ? "text-built" : "text-ink-2"}`}>
            {solution.checked ? (
              <CheckCircleIcon size={16} weight="fill" aria-hidden="true" />
            ) : (
              <WarningIcon size={16} aria-hidden="true" />
            )}
            {solution.checked
              ? `Final answer checked by Ifiok's maths engine: ${solution.final.stated}${solution.final.unit ? ` ${solution.final.unit}` : ""}`
              : "Unchecked: Ifiok's maths engine couldn't verify a final number here"}
          </p>
        </div>
      </div>
    </MathHtmlProvider>
  );
}

export function SolutionReveal({ questionId, onShown }: { questionId: string; onShown?: () => void }) {
  const solution = useWorkedSolution(questionId);
  if (solution.data) return <WorkedSolutionView data={solution.data} />;
  return (
    <div className="grid gap-2">
      <div>
        <Button
          variant="outline"
          onClick={() => solution.mutate(undefined, { onSuccess: () => onShown?.() })}
          disabled={solution.isPending}
          aria-busy={solution.isPending}
        >
          {solution.isPending ? "Writing the solution…" : "Show worked solution"}
        </Button>
      </div>
      {solution.isPending ? <p className="text-sm text-ink-2">The first time takes about 15 seconds.</p> : null}
      {solution.isError ? (
        <p role="alert" className="text-sm text-bad">
          {solution.error instanceof ApiError
            ? solution.error.message
            : "Ifiok couldn't write the solution. Try again."}
        </p>
      ) : null}
    </div>
  );
}
