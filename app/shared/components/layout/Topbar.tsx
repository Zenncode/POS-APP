import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Link } from "react-router";
import { checkHealth } from "~/lib/api";
import { useAuth } from "~/shared/hooks/useAuth";
import { useShift } from "~/shared/hooks/useShift";
import { useLiveBadges } from "~/shared/hooks/useLiveBadges";

function useClock(): string | null {
  // Client-only: SSR renders null so server/client HTML match.
  // `new Date()` in a useState initializer + toLocaleString would
  // hydrate-mismatch (server time/tz vs client time/tz).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return null;
  return now.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  const { demoMode } = useAuth();
  const clock = useClock();
  const [online, setOnline] = useState<boolean | null>(null);
  const { ordersDelta, lowStockPulse } = useLiveBadges();
  const { shift, loading: shiftLoading } = useShift();
  const shiftOpen = !!shift && shift.status === "OPEN";

  useEffect(() => {
    let alive = true;
    void checkHealth().then((h) => {
      if (alive) setOnline(h.ok);
    });
    const t = window.setInterval(() => {
      void checkHealth().then((h) => {
        if (alive) setOnline(h.ok);
      });
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-900">{title}</h1>
        {subtitle ? <p className="text-[13px] text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3 text-[13px]">
        <span suppressHydrationWarning className="hidden text-gray-500 md:inline">{clock ?? ""}</span>
        {/* Realtime badges — polite live region, dot pulses on socket events */}
        <span role="status" aria-live="polite" className="flex items-center gap-3 text-xs font-medium text-gray-700">
          {ordersDelta > 0 ? (
            <span aria-label={`${ordersDelta} new order updates`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-600" />{ordersDelta} new
            </span>
          ) : null}
          {lowStockPulse > 0 ? (
            <span aria-label={`${lowStockPulse} low-stock alerts`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-red-600" />Low stock
            </span>
          ) : null}
        </span>
        {!shiftLoading && !shiftOpen ? (
          <Link to="/shift" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700 hover:text-gray-900">
            <span className="size-1.5 rounded-full bg-amber-500" /> Shift closed — open to sell
          </Link>
        ) : null}
        {demoMode || online === false ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700">
            <span className="size-1.5 rounded-full bg-amber-500" /> Demo — API offline
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700">
            <span className="size-1.5 rounded-full bg-emerald-600" /> Live
          </span>
        )}
      </div>
    </header>
  );
}
