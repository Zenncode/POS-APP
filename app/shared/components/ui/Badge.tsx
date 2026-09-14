import type { JSX, ReactNode } from "react";
import type { OrderStatus } from "~/types";

// Minimal dot badges — status is carried by a small colored dot + label.
// No pill backgrounds or borders; text stays neutral so dense tables scan clean.
const dots: Record<string, string> = {
  PAID: "bg-emerald-600",
  PENDING: "bg-amber-500",
  VOID: "bg-gray-400",
  REFUNDED: "bg-sky-600",
  LOW: "bg-red-600",
  OK: "bg-emerald-600",
  MUTED: "bg-gray-400",
  CASH: "bg-emerald-600",
  CARD: "bg-gray-500",
  QR: "bg-sky-600",
  WALLET: "bg-violet-600",
};

export function Badge({ tone, children }: { tone: OrderStatus | string; children: ReactNode }): JSX.Element {
  const dot = dots[tone] ?? dots["MUTED"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-gray-700">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
