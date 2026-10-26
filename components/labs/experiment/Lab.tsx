"use client";

import { CheckCircleIcon, PrinterIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { deriveFrom } from "@ifiok/core/labs/engine";
import type { PublicExperiment } from "@ifiok/core/labs/experiment";
import { useId, useMemo, useState } from "react";
import { ActionBar, SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { useCompareLab, useStartRun, type LabComparisonView, type LabRunData } from "@/lib/queries/labs";
import { ApiError } from "@/lib/query/api";
import { cn } from "@/lib/utils";
import { LabPlot, plotSummary } from "./LabPlot";
import {
  axisLabel,
  fit as fitOf,
  fmt,
  fmtPct,
  points as pointsOf,
  prettyExpr,
  removeSetting,
  takeReading,
  takenReadings,
  type Taken,
} from "./model";
import { MethodList, ReadingsTable } from "./TextMode";

// The virtual experiment (05 §9): set up → measure → analyse → result and report. Readings come
// from the server for this run's seed (the engine, never the model); the accepted value arrives
// only when the student compares their own result. Text mode: method list and readings table.

type Step = "setup" | "measure" | "analyse" | "result";

export function Lab(props: {
  labId: string;
  experiment: PublicExperiment;
  origin: "manual" | "topic";
  sourceTitle: string | null;
}) {
  const { labId, experiment: exp } = props;
  const start = useStartRun(labId);
  const compare = useCompareLab(labId);
  const [step, setStep] = useState<Step>("setup");
  const [run, setRun] = useState<(LabRunData & { id: string }) | null>(null);
  const [taken, setTaken] = useState<Taken>({});
  const [setting, setSetting] = useState<number | null>(null);
  const [fitShown, setFitShown] = useState(false);
  const [stated, setStated] = useState("");
  const [result, setResult] = useState<LabComparisonView | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingId = useId();
  const statedId = useId();

  const readings = useMemo(() => (run ? takenReadings(run.settings, taken) : []), [run, taken]);
  const pts = useMemo(() => pointsOf(exp, readings), [exp, readings]);
  const fit = useMemo(() => (fitShown ? fitOf(exp, readings) : null), [exp, readings, fitShown]);
  const xLabel = axisLabel(exp, "x");
  const yLabel = axisLabel(exp, "y");
  const d = exp.analysis.derive;
  const unit = (u: string) => (u ? ` ${u}` : "");

  const begin = () => {
    setError(null);
    start.mutate(undefined, {
      onSuccess: (r) => {
        setRun({ ...r, id: crypto.randomUUID() });
        setTaken({});
        setSetting(r.settings[0]?.value ?? null);
        setFitShown(false);
        setStated("");
        setResult(null);
        setStep("measure");
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "The lab didn't start. Try again."),
    });
  };

  const current = run?.settings.find((s) => s.value === setting) ?? null;
  const countHere = setting === null ? 0 : (taken[String(setting)] ?? 0);
  const lastReading = current && countHere ? current.readings[countHere - 1] : null;
  const settingsTaken = readings.length;

  const take = () => {
    if (setting === null || !run) return;
    const next = takeReading(taken, setting, exp.repeats);
    setTaken(next);
    // All repeats done here: move on to the next setting not yet measured.
    if ((next[String(setting)] ?? 0) >= exp.repeats) {
      const free = run.settings.find((s) => !next[String(s.value)]);
      if (free) setSetting(free.value);
    }
  };

  const submit = () => {
    if (!run) return;
    const value = Number(stated.replace(/,/g, ""));
    if (!stated.trim() || !Number.isFinite(value)) return setError(`Enter your value of ${d.symbol} as a number.`);
    setError(null);
    compare.mutate(
      {
        run_id: run.id,
        seed: run.seed,
        taken: readings.map((r) => ({ value: r.value, count: r.readings.length })),
        stated: value,
      },
      {
        onSuccess: (r) => {
          setResult(r);
          setStep("result");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Your result wasn't checked. Try again."),
      },
    );
  };

  const label =
    props.origin === "topic"
      ? "Generated from the topic, not your manual"
      : `From your manual${props.sourceTitle ? `, ${props.sourceTitle}` : ""}`;

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink-2">{label}</p>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={textMode}
            onChange={(e) => setTextMode(e.target.checked)}
            className="h-5 w-5"
          />
          Text mode
        </label>
      </div>

      {step === "setup" ? (
        <section aria-labelledby="lab-setup" className="grid gap-5">
          <SectionHeading id="lab-setup">Aim</SectionHeading>
          <p className="text-base">{exp.aim}</p>
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">Apparatus</h3>
            <ul className="grid list-disc gap-1 pl-5 text-base">
              {exp.apparatus.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">Method</h3>
            <MethodList experiment={exp} />
          </div>
          {exp.precautions.length ? (
            <div className="grid gap-2">
              <h3 className="text-base font-semibold">Precautions</h3>
              <ul className="grid list-disc gap-1 pl-5 text-base">
                {exp.precautions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ActionBar over="screen">
            <Button onClick={begin} disabled={start.isPending} aria-busy={start.isPending}>
              {start.isPending ? "Setting up…" : "Start the experiment"}
            </Button>
          </ActionBar>
        </section>
      ) : null}

      {step === "measure" && run ? (
        <section aria-labelledby="lab-measure" className="grid grid-cols-1 gap-5">
          <SectionHeading id="lab-measure">Take readings</SectionHeading>
          <p className="text-base text-ink-2">
            Take readings at {exp.min_readings} or more values of {exp.independent.symbol} across the whole range
            {exp.repeats > 1 ? `, ${exp.repeats} readings at each` : ""}.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor={settingId} className="grid gap-1.5">
              <span className="text-base font-semibold">
                {exp.independent.label} ({exp.independent.symbol}
                {exp.independent.unit ? `, ${exp.independent.unit}` : ""})
              </span>
              <select
                id={settingId}
                value={setting ?? ""}
                onChange={(e) => setSetting(Number(e.target.value))}
                className={cn(fieldClass, "w-40")}
              >
                {run.settings.map((s) => (
                  <option key={s.value} value={s.value}>
                    {fmt(s.value)}
                    {unit(exp.independent.unit)}
                    {taken[String(s.value)] ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={take} disabled={countHere >= exp.repeats}>
              {countHere >= exp.repeats
                ? "All readings taken here"
                : exp.repeats > 1
                  ? `Take reading ${countHere + 1} of ${exp.repeats}`
                  : "Take reading"}
            </Button>
          </div>
          <p className="text-base" aria-live="polite">
            {lastReading !== null ? (
              <>
                {exp.measured.label}:{" "}
                <span className="font-mono text-lg text-quantity">
                  {lastReading}
                  {unit(exp.measured.unit)}
                </span>
              </>
            ) : (
              <span className="text-ink-2">Readings appear here.</span>
            )}
          </p>
          <ReadingsTable experiment={exp} readings={readings} onRemove={(v) => setTaken((t) => removeSetting(t, v))} />
          <LabPlot points={pts} fit={null} xLabel={xLabel} yLabel={yLabel} textOnly={textMode} />
          <ActionBar over="screen">
            <Button onClick={() => setStep("analyse")} disabled={settingsTaken < 2}>
              {settingsTaken < 2 ? "Take readings at 2 or more settings" : "Analyse the results"}
            </Button>
          </ActionBar>
        </section>
      ) : null}

      {step === "analyse" && run ? (
        <section aria-labelledby="lab-analyse" className="grid grid-cols-1 gap-5">
          <SectionHeading id="lab-analyse">Analyse</SectionHeading>
          <LabPlot points={pts} fit={fit} xLabel={xLabel} yLabel={yLabel} textOnly={textMode} />
          {fit ? (
            <div className="grid gap-1 text-base">
              <p>
                Gradient of the best-fit line: <span className="font-semibold tabular-nums">{fmt(fit.gradient)}</span>
              </p>
              <p>
                Intercept: <span className="font-semibold tabular-nums">{fmt(fit.intercept)}</span>
              </p>
              <p className="text-sm text-ink-2">Least-squares line through your {fit.n} points.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setFitShown(true)}>
                Draw the best-fit line
              </Button>
              <Button variant="ghost" onClick={() => setStep("measure")}>
                Take more readings
              </Button>
            </div>
          )}
          {fit ? (
            <div className="grid gap-3">
              <p className="text-base">
                {d.label}:{" "}
                <span className="font-semibold">
                  {d.symbol} = {prettyExpr(d.expr)}
                </span>
              </p>
              <label htmlFor={statedId} className="grid max-w-xs gap-1.5">
                <span className="text-base font-semibold">
                  Your value of {d.symbol}
                  {d.unit ? ` (${d.unit})` : ""}
                </span>
                <Input id={statedId} inputMode="decimal" value={stated} onChange={(e) => setStated(e.target.value)} />
              </label>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-base text-bad">
              {error}
            </p>
          ) : null}
          {fit ? (
            <ActionBar over="screen">
              <Button onClick={submit} disabled={!stated.trim() || compare.isPending} aria-busy={compare.isPending}>
                {compare.isPending ? "Checking…" : "Check my result"}
              </Button>
            </ActionBar>
          ) : null}
        </section>
      ) : null}

      {step === "result" && run && result ? (
        <Report
          experiment={exp}
          readings={readings}
          result={result}
          label={label}
          textMode={textMode}
          derivedFromFit={(() => {
            const f = fitOf(exp, readings);
            return f ? deriveFrom({ from: exp.analysis.derive.from, deriveAst: exp.analysis.deriveAst }, f) : null;
          })()}
          onAgain={begin}
          busy={start.isPending}
        />
      ) : null}

      {error && step !== "analyse" ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Report(props: {
  experiment: PublicExperiment;
  readings: ReturnType<typeof takenReadings>;
  result: LabComparisonView;
  label: string;
  textMode: boolean;
  derivedFromFit: number | null;
  onAgain: () => void;
  busy: boolean;
}) {
  const { experiment: exp, result: r, readings } = props;
  const d = exp.analysis.derive;
  const pts = pointsOf(exp, readings);
  const fit = fitOf(exp, readings);
  const xLabel = axisLabel(exp, "x");
  const yLabel = axisLabel(exp, "y");
  const u = r.unit ? ` ${r.unit}` : "";

  return (
    <article aria-labelledby="lab-report" className="grid grid-cols-1 gap-6">
      <div
        role="status"
        className={cn(
          "grid gap-1 rounded-[var(--radius-input)] border-l-4 px-4 py-3 print:hidden",
          r.withinTolerance ? "border-ok bg-built-soft" : "border-bad bg-change-soft",
        )}
      >
        <p className="flex items-center gap-2 text-base font-semibold">
          {r.withinTolerance ? (
            <CheckCircleIcon size={20} weight="fill" className="text-ok" aria-hidden="true" />
          ) : (
            <WarningCircleIcon size={20} weight="fill" className="text-bad" aria-hidden="true" />
          )}
          Your {d.symbol} = {fmt(r.stated)}
          {u} · accepted {fmt(r.accepted)}
          {u} · {fmtPct(r.errorPct)} off
        </p>
        <p className="text-base">
          {r.withinTolerance
            ? `Within the ±${r.tolerancePct}% a careful practical reaches.`
            : `Outside the ±${r.tolerancePct}% a careful practical reaches.`}
        </p>
      </div>

      <section aria-labelledby="lab-gap" className="grid gap-2 print:hidden">
        <SectionHeading id="lab-gap">Why the gap</SectionHeading>
        <ul className="grid list-disc gap-1.5 pl-5 text-base">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {exp.viva.length ? (
        <section aria-labelledby="lab-viva" className="grid gap-2 print:hidden">
          <SectionHeading id="lab-viva">Viva questions</SectionHeading>
          {exp.viva.map((v) => (
            <details key={v.q} className="rounded-[var(--radius-input)] border border-line px-4 py-2">
              <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold">{v.q}</summary>
              <p className="pb-2 text-base">{v.a}</p>
            </details>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="lab-report" className="grid grid-cols-1 gap-4 border-t border-line pt-6">
        <h2 id="lab-report" className="font-display text-xl font-semibold">
          Lab report: {exp.title}
        </h2>
        <p className="text-sm text-ink-2">{props.label}. Readings from Ifiok&apos;s virtual experiment engine.</p>
        <ReportPart title="Aim">
          <p>{exp.aim}</p>
        </ReportPart>
        <ReportPart title="Apparatus">
          <p>{exp.apparatus.join(", ")}.</p>
        </ReportPart>
        <ReportPart title="Method">
          <MethodList experiment={exp} />
        </ReportPart>
        <ReportPart title="Results">
          <ReadingsTable experiment={exp} readings={readings} />
          <LabPlot points={pts} fit={fit} xLabel={xLabel} yLabel={yLabel} textOnly={props.textMode} />
          {props.textMode ? null : <p className="sr-only">{plotSummary(pts, fit, xLabel, yLabel)}</p>}
        </ReportPart>
        <ReportPart title="Calculation">
          {fit ? (
            <p>
              Gradient = {fmt(fit.gradient)}, intercept = {fmt(fit.intercept)}. {d.symbol} = {prettyExpr(d.expr)} ={" "}
              {props.derivedFromFit !== null ? fmt(props.derivedFromFit) : "—"}
              {u}. Value stated: {fmt(r.stated)}
              {u}.
            </p>
          ) : null}
        </ReportPart>
        <ReportPart title="Error discussion">
          <p>
            Accepted value {fmt(r.accepted)}
            {u}; percentage error {fmtPct(r.errorPct)}.
          </p>
          <ul className="grid list-disc gap-1 pl-5">
            {r.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </ReportPart>
        {exp.precautions.length ? (
          <ReportPart title="Precautions">
            <ul className="grid list-disc gap-1 pl-5">
              {exp.precautions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </ReportPart>
        ) : null}
      </section>

      <ActionBar over="screen">
        <Button onClick={() => window.print()}>
          <PrinterIcon size={20} aria-hidden="true" /> Print the report
        </Button>
        <Button variant="outline" onClick={props.onAgain} disabled={props.busy} aria-busy={props.busy}>
          Run it again
        </Button>
      </ActionBar>
    </article>
  );
}

function ReportPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 text-base">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
