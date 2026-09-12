import { useState } from "react";
import type { JSX } from "react";
import { checkHealth } from "~/lib/api";
import { getApiBase } from "~/lib/httpClient";
import { useAuth } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";

export function meta(): { title: string }[] {
  return [{ title: "Settings — POS Terminal" }];
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
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="rounded-[14px] border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900">Store</h2>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-gray-700">Store name</span>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-gray-700">Receipt footer</span>
              <input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-gray-700">Device label</span>
              <input value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" />
            </label>
            <p className="text-xs text-gray-400">Saved locally on this device (per-terminal settings).</p>
          </div>
        </section>

        <section className="rounded-[14px] border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900">Connection</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">API base</dt><dd className="font-mono text-gray-900">{getApiBase() || "(same-origin /api)"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Staff</dt><dd className="text-gray-900">{user?.name} · {user?.role}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Mode</dt><dd className="text-gray-900">{demoMode ? "Demo (offline)" : "Live"}</dd></div>
            {health ? <div className="flex justify-between"><dt className="text-gray-500">Last check</dt><dd className="text-gray-900">{health}</dd></div> : null}
          </dl>
          <div className="mt-3">
            <Button onClick={() => void onCheck()} disabled={checking}>{checking ? "Checking…" : "Test connection"}</Button>
          </div>
          <p className="mt-3 text-[13px] text-gray-500">
            Live API: set <span className="font-mono">VITE_API_URL=http://localhost:3000</span> then restart dev server.
            Endpoints used: <span className="font-mono">/api/auth/*</span>, <span className="font-mono">/api/products</span>, <span className="font-mono">/api/categories</span>, <span className="font-mono">/api/orders + Idempotency-Key</span>, <span className="font-mono">/api/reports/sales/daily</span>.
          </p>
        </section>

        <section className="rounded-[14px] border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900">Shortcuts</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li><kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">F2</kbd> — focus search</li>
            <li><kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">F8</kbd> — open charge</li>
            <li><kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> — close dialog</li>
            <li><kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> — confirm / barcode add</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
