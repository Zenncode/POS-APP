import type { JSX, ReactNode } from "react";

export function EmptyState({ title, action }: { title: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="text-sm text-gray-600">{title}</p>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-[13px] text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-[13px] text-gray-500">{sub}</p> : null}
    </div>
  );
}

export function Spinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-10" role="status" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-700" />
    </div>
  );
}
