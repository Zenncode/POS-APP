import type { JSX, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

interface Option { value: string; label: string; disabled?: boolean; }

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { options, value, onChange, placeholder, label, error, hint, required, className = "", id, ...rest },
  ref,
): JSX.Element {
  const autoId = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const selectId = id ?? (label ? `sel-${label.replace(/\W+/g, "-").toLowerCase()}-${autoId}` : `sel-${autoId}`);
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <label htmlFor={selectId} className="block">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-0.5" aria-hidden="true">*</span>}
        </span>
      ) : null}
      <select
        id={selectId}
        ref={ref}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] ${
          error ? "border-[var(--color-border-error)]" : "border-[var(--color-border)]"
        } ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {error ? (
        <span id={errorId} className="mt-1 block text-sm text-[var(--color-danger)]" role="alert">{error}</span>
      ) : hint ? (
        <span id={hintId} className="mt-1 block text-sm text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
});

Select.displayName = "Select";