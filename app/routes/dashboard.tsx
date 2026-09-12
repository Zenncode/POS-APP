import { useEffect, useState } from "react";
import type { JSX } from "react";
import { getDailyReport } from "~/lib/api";
import { formatCents, todayISO } from "~/lib/format";
import { useToast } from "~/shared/hooks/useToast";
import { Badge } from "~/shared/components/ui/Badge";
import { Spinner, StatCard } from "~/shared/components/ui/Feedback";
import type { DailyReport } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Dashboard — POS Terminal" }];
}

export default function Dashboard(): JSX.Element {
  const { push } = useToast();
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDailyReport(date)
      .then(setReport)
      .catch(() => push("error", "Failed to load report. Try again."))
      .finally(() => setLoading(false));
  }, [date, push]);

  const maxHour = Math.max(1, ...(report?.byHour.map((h) => h.totalCents) ?? [1]));

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
            aria-label="Report date"
          />
          <span className="text-[13px] text-gray-500">Manager+ in live mode · demo data offline</span>
        </div>

        {loading || !report ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Today's sales" value={formatCents(report.totalCents)} sub={`${report.orderCount} orders`} />
              <StatCard label="Orders" value={String(report.orderCount)} sub="Paid + pending" />
              <StatCard label="Avg ticket" value={formatCents(report.avgTicketCents)} sub="Per order" />
              <StatCard label="Low stock" value={String(report.lowStock.length)} sub="Needs restock" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-gray-900">Sales by hour</h2>
                <div className="flex h-32 items-end gap-1.5">
                  {report.byHour.map((h) => (
                    <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${h.hour}:00 · ${formatCents(h.totalCents)}`}>
                      <div
                        className="w-full rounded-t bg-emerald-700/90"
                        style={{ height: `${Math.max(4, (h.totalCents / maxHour) * 100)}px` }}
                      />
                      <span className="text-[10px] tabular-nums text-gray-400">{h.hour}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[14px] border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-gray-900">Top 5 products</h2>
                <ul className="divide-y divide-gray-100">
                  {report.topProducts.slice(0, 5).map((t) => (
                    <li key={t.productId} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-gray-900">{t.name} <span className="text-gray-400">×{t.qty}</span></span>
                      <span className="tabular-nums text-gray-900">{formatCents(t.totalCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-[14px] border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium text-gray-900">Low stock alerts</h2>
              {report.lowStock.length === 0 ? (
                <p className="text-sm text-gray-500">All stocked. Nice.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {report.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-900">{p.name} <span className="font-mono text-xs text-gray-400">{p.sku}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-gray-600">{p.stock} left</span>
                        <Badge tone="LOW">Restock</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
