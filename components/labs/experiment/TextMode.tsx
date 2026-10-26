import type { SettingReadings } from "@ifiok/core/labs/engine";
import type { PublicExperiment } from "@ifiok/core/labs/experiment";
import { fmt, methodSteps } from "./model";

// Text mode (F4-FR6, 05 §8): the method as a list and the readings as a table. The readings table
// is also the lab's working table in the normal view.

export function MethodList({ experiment }: { experiment: PublicExperiment }) {
  return (
    <ol className="grid list-decimal gap-1.5 pl-5 text-base">
      {methodSteps(experiment).map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}

export function ReadingsTable(props: {
  experiment: PublicExperiment;
  readings: SettingReadings[];
  onRemove?: (value: number) => void;
}) {
  const { experiment: exp, readings } = props;
  const unit = (u: string) => (u ? ` (${u})` : "");
  if (!readings.length) return <p className="text-base text-ink-2">No readings yet.</p>;
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-base tabular-nums">
        <caption className="sr-only">Readings</caption>
        <thead>
          <tr className="border-b border-line text-left text-sm text-ink-2">
            <th scope="col" className="py-2 pr-4 font-semibold">
              {exp.independent.symbol}
              {unit(exp.independent.unit)}
            </th>
            {Array.from({ length: exp.repeats }, (_, i) => (
              <th key={i} scope="col" className="py-2 pr-4 font-semibold">
                {exp.measured.symbol}
                {exp.repeats > 1 ? `${i + 1}` : ""}
                {unit(exp.measured.unit)}
              </th>
            ))}
            {exp.repeats > 1 ? (
              <th scope="col" className="py-2 pr-4 font-semibold">
                Mean
              </th>
            ) : null}
            {props.onRemove ? (
              <th scope="col" className="py-2">
                <span className="sr-only">Remove</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {readings.map((s) => {
            const mean = s.readings.reduce((a, b) => a + b, 0) / s.readings.length;
            return (
              <tr key={s.value} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {fmt(s.value)}
                </th>
                {Array.from({ length: exp.repeats }, (_, i) => (
                  <td key={i} className="py-2 pr-4 font-mono">
                    {s.readings[i] !== undefined ? s.readings[i] : <span className="text-ink-2">–</span>}
                  </td>
                ))}
                {exp.repeats > 1 ? <td className="py-2 pr-4">{fmt(mean)}</td> : null}
                {props.onRemove ? (
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => props.onRemove?.(s.value)}
                      className="min-h-11 px-2 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline print:hidden"
                      aria-label={`Remove the readings at ${exp.independent.symbol} = ${fmt(s.value)}`}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
