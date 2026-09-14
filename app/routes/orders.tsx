import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { getOrder, listOrders, requestOverride, voidOrder } from "~/lib/api";
import { formatCents, formatDateTime } from "~/lib/format";
import { useToast } from "~/shared/hooks/useToast";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";
import { Badge } from "~/shared/components/ui/Badge";
import { Button } from "~/shared/components/ui/Button";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import { Modal } from "~/shared/components/ui/Modal";
import type { Order } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Orders — POS Terminal" }];
}

export default function Orders(): JSX.Element {
  const { push } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [voidPin, setVoidPin] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidBusy, setVoidBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOrders({ status: status || undefined, q: q || undefined });
      setOrders(res.data);
      setTotal(res.total);
    } catch {
      push("error", "Failed to load orders. Try again.");
    } finally {
      setLoading(false);
    }
  }, [status, q, push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string): Promise<void> {
    try {
      const o = await getOrder(id);
      setSelected(o);
    } catch {
      push("error", "Failed to open order. Try again.");
    }
  }

  async function doVoid(): Promise<void> {
    if (!selected || voidBusy) return;
    setVoidBusy(true);
    try {
      let overrideToken: string | undefined;
      const needsPin = !roleAtLeast(user?.role, "MANAGER");
      if (needsPin) {
        if (!/^\d{4,8}$/.test(voidPin)) {
          push("error", "Enter the manager PIN (4-8 digits).");
          setVoidBusy(false);
          return;
        }
        overrideToken = await requestOverride(voidPin);
      }
      const updated = await voidOrder(selected.id, overrideToken);
      setSelected(updated);
      push("success", `${updated.orderNumber} voided · stock restored`);
      setVoidOpen(false);
      setVoidPin("");
      void load();
    } catch {
      push("error", "Void failed. Try again.");
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-full flex-col border-r border-gray-200 bg-white md:w-[480px]">
        <div className="border-b border-gray-200 p-3">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input placeholder="Search order #…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm" aria-label="Status filter">
              <option value="">All</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="VOID">Void</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-500">{total} orders</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <div className="p-4"><EmptyState title="No orders found. Make a sale in Register →" /></div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map((o) => (
                <li key={o.id}>
                  <button onClick={() => void openDetail(o.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${selected?.id === o.id ? "bg-gray-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tabular-nums text-gray-900">{o.orderNumber}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(o.createdAt)} · {o.cashier?.name ?? "—"} · {o.items.length} items</p>
                    </div>
                    <Badge tone={o.status}>{o.status}</Badge>
                    <span className="text-sm font-medium tabular-nums text-gray-900">{formatCents(o.totalCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 overflow-y-auto bg-gray-50 p-6 md:block">
        {!selected ? (
          <div className="mx-auto max-w-md pt-10"><EmptyState title="Select an order to see items, payments and void action." /></div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-[14px] border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm tabular-nums text-gray-500">{selected.orderNumber}</p>
                <h2 className="text-lg font-semibold text-gray-900">{formatCents(selected.totalCents)}</h2>
                <p className="text-[13px] text-gray-500">{formatDateTime(selected.createdAt)} · {selected.cashier?.name ?? "—"}</p>
              </div>
              <Badge tone={selected.status}>{selected.status}</Badge>
            </div>

            <h3 className="mb-2 mt-6 text-sm font-medium text-gray-900">Items</h3>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {selected.items.map((it) => (
                <li key={it.id} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-gray-900">{it.quantity}× {it.nameSnapshot} <span className="text-xs tabular-nums text-gray-400">{it.skuSnapshot}</span></span>
                  <span className="tabular-nums text-gray-900">{formatCents(it.lineTotalCents)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1 text-sm tabular-nums text-gray-600">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(selected.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{formatCents(selected.taxCents)}</dd></div>
              <div className="flex justify-between"><dt>Paid</dt><dd>{formatCents(selected.paidCents)}</dd></div>
              <div className="flex justify-between"><dt>Change</dt><dd>{formatCents(selected.changeCents)}</dd></div>
            </dl>

            <h3 className="mb-2 mt-6 text-sm font-medium text-gray-900">Payments</h3>
            <div className="flex gap-2">
              {selected.payments.map((p) => (
                <Badge key={p.id} tone={p.method}>{p.method} · {formatCents(p.amountCents)}</Badge>
              ))}
            </div>

            {selected.status !== "VOID" ? (
              <div className="mt-6">
                <Button variant="danger" onClick={() => setVoidOpen(true)}>Void order…</Button>
                <p className="mt-1 text-xs text-gray-500">
                  {roleAtLeast(user?.role, "MANAGER") ? "Manager: direct void, stock is restored." : "Cashier: needs manager PIN approval."}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {voidOpen && selected ? (
        <Modal title={`Void ${selected.orderNumber}?`} onClose={() => setVoidOpen(false)}>
          <p className="text-sm text-gray-600">Stock will be restored. This cannot be undone.</p>
          {!roleAtLeast(user?.role, "MANAGER") ? (
            <div className="mt-3">
              <Input label="Manager PIN" type="password" inputMode="numeric" value={voidPin} onChange={(e) => setVoidPin(e.target.value)} placeholder="4-8 digits" autoFocus />
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" full onClick={() => setVoidOpen(false)}>Keep order</Button>
            <Button variant="danger" full onClick={() => void doVoid()} disabled={voidBusy}>{voidBusy ? "Voiding…" : "Void + restore stock"}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
