import type { InputHTMLAttributes, JSX } from "react";
import { forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className = "", id, ...rest },
  ref,
): JSX.Element {
  const inputId = id ?? `in-${label?.replace(/\W+/g, "-").toLowerCase() ?? "field"}`;
  return (
    <label htmlFor={inputId} className="block">
      {label ? <span className="mb-1 block text-[13px] font-medium text-gray-700">{label}</span> : null}
      <input
        id={inputId}
        ref={ref}
        className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 ${
          error ? "border-red-500" : "border-gray-300"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="mt-1 block text-[13px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[13px] text-gray-500">{hint}</span>
      ) : null}
    </label>
  );
});
