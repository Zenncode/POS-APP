import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Link, useParams } from "react-router";
import { getOrder } from "~/lib/api";
import { formatCents, formatDateTime } from "~/lib/format";
import { Badge } from "~/shared/components/ui/Badge";
import { Spinner } from "~/shared/components/ui/Feedback";
import type { Order } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Order detail — POS Terminal" }];
}

export default function OrderDetail(): JSX.Element {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getOrder(id)
      .then(setOrder)
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="p-6">
        <Link to="/orders" className="text-sm text-gray-600 hover:text-gray-900">← Orders</Link>
        <p className="mt-2 text-sm text-gray-600">Order not found.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl rounded-[14px] border border-gray-200 bg-white p-6">
        <Link to="/orders" className="text-sm text-gray-600 hover:text-gray-900">← Orders</Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <p className="font-mono text-sm text-gray-500">{order.orderNumber}</p>
            <h1 className="text-xl font-semibold tabular-nums text-gray-900">{formatCents(order.totalCents)}</h1>
            <p className="text-[13px] text-gray-500">{formatDateTime(order.createdAt)} · {order.cashier?.name ?? "—"}</p>
          </div>
          <Badge tone={order.status}>{order.status}</Badge>
        </div>
        <h2 className="mb-2 mt-6 text-sm font-medium text-gray-900">Items</h2>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between px-3 py-2 text-sm">
              <span>{it.quantity}× {it.nameSnapshot}</span>
              <span className="tabular-nums">{formatCents(it.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          {order.payments.map((p) => (
            <Badge key={p.id} tone={p.method}>{p.method} · {formatCents(p.amountCents)}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
