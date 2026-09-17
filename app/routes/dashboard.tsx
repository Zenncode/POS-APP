import { useEffect, useState } from "react";
import type { JSX } from "react";
import { getDailyReport, getSummary } from "~/lib/api";
import { formatCents, todayISO } from "~/lib/format";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Badge } from "~/shared/components/ui/Badge";
import { Button } from "~/shared/components/ui/Button";
import { EmptyState, Spinner, StatCard } from "~/shared/components/ui/Feedback";
import type { DailyReport } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Dashboard — Point of Sale" }];
}

export default function Dashboard(): JSX.Element {
  const { push } = useToast();
  const { user, demoMode } = useAuth();
  const allowed = demoMode || roleAtLeast(user?.role, "MANAGER");
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [trend, setTrend] = useState<{ day: string; totalCents: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    if (!allowed || !date) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadFailed(false);
    getDailyReport(date)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch(() => {
        if (alive) {
          setLoadFailed(true);
          push("error", "Failed to load report. Try again.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date, push, allowed, reloadKey]);

  // 14-day sales trend via summary endpoint (one call per day, best-effort).
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setTrendLoading(true);
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    void Promise.allSettled(days.map((day) => getSummary(day, day))).then((results) => {
      if (!alive) return;
      setTrend(
        results.map((r, i) => ({
          day: days[i],
          totalCents: r.status === "fulfilled" ? r.value.totalCents : 0,
        })),
      );
      setTrendLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [allowed]);

  const maxHour = Math.max(1, ...((report?.byHour ?? []).map((h) => h.totalCents)), 1);
  const maxTrend = Math.max(1, ...trend.map((t) => t.totalCents));

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-surface)] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <input
            type="date"
            value={date}
            suppressHydrationWarning
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            aria-label="Report date"
          />
          <span className="text-[13px] text-[var(--color-text-muted)]">Managers see live data · demo data when offline</span>
        </div>

        {!allowed ? (
          <EmptyState title="Dashboard is for managers. Ask a manager to view today's numbers." />
        ) : loading ? (
          <Spinner />
        ) : loadFailed || !report ? (
          <EmptyState
            title="Couldn't load the report. Check connection and retry."
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Today's sales" value={formatCents(report.totalCents)} sub={`${report.orderCount} orders`} />
              <StatCard label="Orders" value={String(report.orderCount)} sub="Paid + pending" />
              <StatCard label="Avg ticket" value={formatCents(report.avgTicketCents)} sub="Per order" />
              <StatCard label="Low stock" value={String((report.lowStock ?? []).length)} sub="Needs restock" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <h2 className="mb-3 text-sm font-medium text-[var(--color-text)]">Sales by hour</h2>
                <div className="flex h-32 items-end gap-1.5">
                  {(report.byHour ?? []).map((h) => (
                    <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${h.hour}:00 · ${formatCents(h.totalCents)}`}>
                      <div
                        className="w-full rounded-t bg-[var(--color-primary)]/90"
                        style={{ height: `${Math.max(4, (h.totalCents / maxHour) * 100)}px` }}
                      />
                      <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">{h.hour}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <h2 className="mb-3 text-sm font-medium text-[var(--color-text)]">Top 5 products</h2>
                <ul className="divide-y divide-[var(--color-border)]">
                  {(report.topProducts ?? []).slice(0, 5).map((t) => (
                    <li key={t.productId} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-[var(--color-text)]">{t.name} <span className="text-[var(--color-text-muted)]">×{t.qty}</span></span>
                      <span className="tabular-nums text-[var(--color-text)]">{formatCents(t.totalCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <section aria-labelledby="trend14" className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <h2 id="trend14" className="mb-3 text-sm font-medium text-[var(--color-text)]">Last 14 days</h2>
              {trendLoading ? (
                <Spinner />
              ) : (
                <div
                  role="img"
                  aria-label={`14-day sales trend, total ${formatCents(trend.reduce((s, t) => s + t.totalCents, 0))}`}
                  className="flex h-24 items-end gap-1.5"
                >
                  {trend.map((t) => (
                    <div key={t.day} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${t.day} · ${formatCents(t.totalCents)}`}>
                      <div
                        aria-hidden
                        className="w-full rounded-t bg-[var(--color-primary)]/70"
                        style={{ height: `${Math.max(4, (t.totalCents / maxTrend) * 80)}px` }}
                      />
                      <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">{t.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <h2 className="mb-3 text-sm font-medium text-[var(--color-text)]">Low stock alerts</h2>
              {(report.lowStock ?? []).length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">All stocked. Nice.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {(report.lowStock ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-[var(--color-text)]">{p.name} <span className="text-xs tabular-nums text-[var(--color-text-muted)]">{p.sku}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-[var(--color-text-muted)]">{p.stock} left</span>
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

