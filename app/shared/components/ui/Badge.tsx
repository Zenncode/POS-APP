import type { JSX, ReactNode } from "react";
import type { OrderStatus } from "~/types";

const styles: Record<string, string> = {
  PAID: "bg-gray-100 text-gray-800 border-gray-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  VOID: "bg-white text-red-700 border-red-300",
  REFUNDED: "bg-amber-50 text-amber-900 border-amber-300",
  LOW: "bg-red-50 text-red-700 border-red-200",
  OK: "bg-emerald-50 text-emerald-800 border-emerald-200",
  MUTED: "bg-gray-50 text-gray-600 border-gray-200",
  CASH: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CARD: "bg-blue-50 text-blue-800 border-blue-200",
  QR: "bg-violet-50 text-violet-800 border-violet-200",
};

export function Badge({ tone, children }: { tone: OrderStatus | string; children: ReactNode }): JSX.Element {
  const cls = styles[tone] ?? styles["MUTED"];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}
