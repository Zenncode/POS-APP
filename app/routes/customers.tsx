import { useEffect, useState } from "react";
import type { JSX } from "react";
import { listCustomers } from "~/lib/api";
import { formatDate } from "~/lib/format";
import { useToast } from "~/shared/hooks/useToast";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import type { Customer } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Customers — Point of Sale" }];
}

export default function Customers(): JSX.Element {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoading(true);
      listCustomers(q || undefined)
        .then((res) => setRows(res.data))
        .catch(() => push("error", "Failed to load customers. Try again."))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, push]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-full max-w-md flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] md:w-[400px]">
        <div className="border-b border-[var(--color-border)] p-3">
          <Input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" autoFocus />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <div className="p-4"><EmptyState title="No customers match. Create them in live API or use walk-in." /></div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {rows.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c)} className={`w-full px-4 py-3 text-left hover:bg-[var(--color-surface)] ${selected?.id === c.id ? "bg-[var(--color-surface)]" : ""}`}>
                    <p className="text-sm font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.phone ?? "—"}{c.email ? ` · ${c.email}` : ""}</p>
                    <p className="mt-1 text-xs tabular-nums text-[var(--color-primary)]">{c.loyaltyPoints} pts</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 overflow-y-auto bg-[var(--color-surface)] p-6 md:block">
        {!selected ? (
          <div className="mx-auto max-w-md pt-10"><EmptyState title="Select a customer to see loyalty + recent orders." /></div>
        ) : (
          <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{selected.name}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{selected.phone ?? "No phone"}{selected.email ? ` · ${selected.email}` : ""}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--color-surface)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">Loyalty points</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--color-text)]">{selected.loyaltyPoints}</p>
              </div>
              <div className="rounded-lg bg-[var(--color-surface)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">Member since</p>
                <p className="text-xl font-semibold text-[var(--color-text)]">{selected.createdAt ? formatDate(selected.createdAt) : "—"}</p>
              </div>
            </div>
            <h3 className="mb-2 mt-6 text-sm font-medium text-[var(--color-text)]">Last orders</h3>
            {selected.orders && selected.orders.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                {selected.orders.slice(0, 10).map((o) => (
                  <li key={o.id} className="flex justify-between px-3 py-2 text-sm">
                    <span className="font-mono text-[var(--color-text)]">{o.orderNumber}</span>
                    <span className="tabular-nums text-[var(--color-text-muted)]">{(o.totalCents / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No recent orders. Attach this customer at checkout to build history.</p>
            )}
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">Tip: pick the customer in Register → checkout to link the sale.</p>
          </div>
        )}
      </div>
    </div>
  );
}

