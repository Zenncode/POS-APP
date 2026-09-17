import type { JSX, ReactNode } from "react";

export function EmptyState({ title, action }: { title: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-12 text-center">
      <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <p className="text-[13px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{value}</p>
      {sub ? <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{sub}</p> : null}
      {trend && (
        <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium">
          <span className={trend === "up" ? "text-[var(--color-success)]" : trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
          <span className={trend === "up" ? "text-[var(--color-success)]" : trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}>
            {trendLabel ?? (trend === "up" ? "+5%" : trend === "down" ? "−5%" : "—")}
          </span>
        </span>
      )}
    </div>
  );
}

export function Spinner({ className = "", bare = false }: { className?: string; bare?: boolean }): JSX.Element {
  if (bare) {
    // Decorative ring: no role/aria-label so it never pollutes the
    // accessible name of a wrapping control (e.g. Button's loading state).
    return (
      <div className={`${className || "size-6"} animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]`} aria-hidden="true" />
    );
  }
  const inline = className.length > 0;
  return (
    <div className={inline ? "contents" : "flex items-center justify-center py-10"} role="status" aria-label="Loading">
      <div className={`${inline ? className : "size-6"} animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]`} />
    </div>
  );
}