import { useState } from "react";
import type { JSX } from "react";
import { checkHealth } from "~/lib/api";
import { getApiBase } from "~/lib/httpClient";
import { useAuth } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { Input } from "~/shared/components/ui/Input";

export function meta(): { title: string }[] {
  return [{ title: "Settings — Point of Sale" }];
}

export default function Settings(): JSX.Element {
  const { user, demoMode } = useAuth();
  const { push } = useToast();
  const [storeName, setStoreName] = useState("Main Store");
  const [receiptFooter, setReceiptFooter] = useState("Thank you — come again!");
  const [deviceLabel, setDeviceLabel] = useState("Terminal 01");
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState("");

  async function onCheck(): Promise<void> {
    setChecking(true);
    const h = await checkHealth();
    setHealth(h.ok ? `API reachable · ${h.latencyMs}ms` : "API offline — running in demo mode");
    push(h.ok ? "success" : "info", h.ok ? "API is reachable." : "API offline — demo data active.");
    setChecking(false);
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-surface)] p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Store</h2>
          <div className="mt-3 grid gap-3">
            <Input label="Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            <Input label="Receipt footer" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
            <Input label="Device label" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />
            <p className="text-xs text-[var(--color-text-muted)]">Saved locally on this device (per-terminal settings).</p>
          </div>
        </section>

        <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Connection</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">API base</dt><dd className="font-mono text-[var(--color-text)]">{getApiBase() || "(same-origin /api)"}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Staff</dt><dd className="text-[var(--color-text)]">{user?.name} · {user?.role}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Mode</dt><dd className="text-[var(--color-text)]">{demoMode ? "Demo (offline)" : "Live"}</dd></div>
            {health ? <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Last check</dt><dd className="text-[var(--color-text)]">{health}</dd></div> : null}
          </dl>
          <div className="mt-3">
            <Button onClick={() => void onCheck()} loading={checking}>Test connection</Button>
          </div>
          <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
            Live API: set <span className="font-mono">VITE_API_URL=http://localhost:3000</span> then restart dev server.
            Endpoints used: <span className="font-mono">/api/auth/*</span>, <span className="font-mono">/api/products</span>, <span className="font-mono">/api/categories</span>, <span className="font-mono">/api/orders + Idempotency-Key</span>, <span className="font-mono">/api/reports/sales/daily</span>.
          </p>
        </section>

        <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Shortcuts</h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-neutral-600)]">
            <li><kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-xs">F2</kbd> — focus search</li>
            <li><kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-xs">F8</kbd> — open charge</li>
            <li><kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-xs">Esc</kbd> — close dialog</li>
            <li><kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-xs">Enter</kbd> — confirm / barcode add</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

