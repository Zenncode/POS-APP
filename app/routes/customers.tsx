import { useEffect, useState } from "react";
import type { JSX } from "react";
import { listCustomers } from "~/lib/api";
import { formatDate } from "~/lib/format";
import { useToast } from "~/shared/hooks/useToast";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import type { Customer } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Customers — POS Terminal" }];
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
      <div className="flex w-full max-w-md flex-col border-r border-gray-200 bg-white md:w-[400px]">
        <div className="border-b border-gray-200 p-3">
          <Input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" autoFocus />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <div className="p-4"><EmptyState title="No customers match. Create them in live API or use walk-in." /></div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c)} className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selected?.id === c.id ? "bg-gray-50" : ""}`}>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone ?? "—"}{c.email ? ` · ${c.email}` : ""}</p>
                    <p className="mt-1 text-xs tabular-nums text-emerald-800">{c.loyaltyPoints} pts</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 overflow-y-auto bg-gray-50 p-6 md:block">
        {!selected ? (
          <div className="mx-auto max-w-md pt-10"><EmptyState title="Select a customer to see loyalty + recent orders." /></div>
        ) : (
          <div className="mx-auto max-w-xl rounded-[14px] border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
            <p className="text-sm text-gray-500">{selected.phone ?? "No phone"}{selected.email ? ` · ${selected.email}` : ""}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Loyalty points</p>
                <p className="text-xl font-semibold tabular-nums text-gray-900">{selected.loyaltyPoints}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Member since</p>
                <p className="text-xl font-semibold text-gray-900">{selected.createdAt ? formatDate(selected.createdAt) : "—"}</p>
              </div>
            </div>
            <h3 className="mb-2 mt-6 text-sm font-medium text-gray-900">Last orders</h3>
            {selected.orders && selected.orders.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {selected.orders.slice(0, 10).map((o) => (
                  <li key={o.id} className="flex justify-between px-3 py-2 text-sm">
                    <span className="font-mono text-gray-900">{o.orderNumber}</span>
                    <span className="tabular-nums text-gray-600">{(o.totalCents / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No recent orders. Attach this customer at checkout to build history.</p>
            )}
            <p className="mt-4 text-xs text-gray-400">Tip: pick the customer in Register → checkout to link the sale.</p>
          </div>
        )}
      </div>
    </div>
  );
}
