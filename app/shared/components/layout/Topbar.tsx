import { useEffect, useState } from "react";
import type { JSX } from "react";
import { checkHealth } from "~/lib/api";
import { useAuth } from "~/shared/hooks/useAuth";

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  const { demoMode } = useAuth();
  const clock = useClock();
  const [online, setOnline] = useState<boolean | null>(null);

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
        <span className="hidden text-gray-500 md:inline">{clock}</span>
        {demoMode || online === false ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
            <span className="size-1.5 rounded-full bg-amber-500" /> Demo — API offline
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-600" /> Live
          </span>
        )}
      </div>
    </header>
  );
}
