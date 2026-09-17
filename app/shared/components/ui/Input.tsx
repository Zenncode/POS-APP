import type { InputHTMLAttributes, JSX, ReactNode } from "react";
import { forwardRef, useId, useState } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  passwordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, required, leftIcon, rightIcon, passwordToggle, className = "", id, type, ...rest },
  ref,
): JSX.Element {
  const autoId = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const inputId = id ?? (label ? `in-${label.replace(/\W+/g, "-").toLowerCase()}-${autoId}` : `in-${autoId}`);
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const showToggle = type === "password" && passwordToggle === true;
  const [shown, setShown] = useState(false);
  const effectiveType = showToggle && shown ? "text" : (type ?? "text");
  const toggleLabel = shown ? "Hide password" : "Show password";
  const needsRightPad = Boolean(rightIcon) || showToggle;

  return (
    <label htmlFor={inputId} className="block relative">
      {label ? (
        <span className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-0.5" aria-hidden="true">*</span>}
        </span>
      ) : null}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? "true" : "false"}
          className={`h-10 w-full rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] ${
            error ? "border-[var(--color-border-error)]" : "border-[var(--color-border)]"
          } ${leftIcon ? "pl-10" : ""} ${needsRightPad ? "pr-10" : ""} ${className}`}
          {...rest}
          type={effectiveType}
        />
        {showToggle ? (
          <button
            type="button"
            aria-label={toggleLabel}
            aria-pressed={shown}
            title={toggleLabel}
            onClick={() => setShown((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-1 rounded-sm"
          >
            {shown ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : (
          rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true">
              {rightIcon}
            </span>
          )
        )}
      </div>
      {error ? (
        <span id={errorId} className="mt-1 block text-sm text-[var(--color-danger)]" role="alert">{error}</span>
      ) : hint ? (
        <span id={hintId} className="mt-1 block text-sm text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
});

Input.displayName = "Input";