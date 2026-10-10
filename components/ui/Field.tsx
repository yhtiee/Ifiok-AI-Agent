import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";

// Labelled form controls (07 §7: forms have labels; errors are announced).

const control =
  "min-h-12 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 aria-[invalid=true]:border-bad";

type FieldShellProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (ids: FieldIds) => ReactNode;
};
type FieldIds = { id: string; describedBy: string | undefined; invalid: boolean };

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
      <p id={errorId} role="alert" className={error ? "text-sm text-bad" : "sr-only"}>
        {error ?? ""}
      </p>
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextField({ label, hint, error, className = "", ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${className}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function SelectField({ label, hint, error, className = "", children, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} appearance-auto ${className}`}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
