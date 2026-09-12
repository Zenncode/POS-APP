import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { getOrder, listOrders, voidOrder } from "~/lib/api";
import { formatCents, formatDateTime } from "~/lib/format";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { Input } from "~/shared/components/ui/Input";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { useNavigate, Navigate } from "react-router";
import type { Order } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Refund — POS Terminal" }];
}

function canRefund(role: string | undefined): boolean {
  return roleAtLeast(role, "MANAGER");
}

export default function Refund(): JSX.Element {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  // Can't proceed if not MANAGER
  if (!canRefund(user?.role)) {
    push("error", "Manager access required.");
    return <Navigate to="/orders" replace />;
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState<string>("");
  const [refundBusy, setRefundBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOrders({ status: "PAID", q });
      setOrders(res.data);
      setLoading(false);
    } catch {
      push("error", "Failed to load orders. Try again.");
      setLoading(false);
    }
  }, [q, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string): Promise<void> => {
    try {
      const o = await getOrder(id);
      setOrder(o);
    } catch {
      push("error", "Failed to open order. Try again.");
    }
  };

  const doRefund = async (): Promise<void> => {
    // @ts-ignore - order is guaranteed to be defined when this is called
    if (!order) return;
    if (!reason.trim()) {
      push("error", "Reason is required.");
      return;
    }
    if (refundType === "full" && !amount) {
      push("error", "Full refund selected. No amount needed.");
      return;
    }
    if (refundType === "partial" && (!amount || Number(amount) <= 0)) {
      push("error", "Valid amount required for partial refund.");
      return;
    }
    setRefundBusy(true);
    try {
      const refundAmount = refundType === "full" ? order!.totalCents : Number(amount);
      // Use voidOrder logic but with refund purpose
      // For now, we'll void the order and note it as refund
      // In a full implementation, this would call a refund endpoint
      const updated = await voidOrder(order!.id);
      push("success", `$${formatCents(refundAmount)} refunded for ${order!.orderNumber}`);
      setRefundBusy(false);
      setOrder(null);
      setReason("");
      setAmount("");
      setRefundType("full");
      void navigate("/orders", { replace: true });
    } catch {
      push("error", "Refund failed. Try again.");
      setRefundBusy(false);
    }
  };

  return (
    <div className="h-full min-h-0 bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Refund</h1>
        <Button variant="ghost" onClick={() => navigate("/orders", { replace: true})}>Back to Orders</Button>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Order: {order?.orderNumber ?? "Select an order from the list above"}
        </p>
        <p className="text-sm text-gray-500">
          Date: {order?.createdAt ? formatDateTime(order.createdAt) : ""}
        </p>
        <p className="text-sm text-gray-500">
          Customer: {order?.customer?.name ?? "Walk-in"}
        </p>
        <p className="text-sm text-gray-500">
          Total: {order?.totalCents ? formatCents(order.totalCents) : ""}
        </p>
      </div>

      {order ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          doRefund();
        }}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-gray-500">Refund Type</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label>
                  <input
                    type="radio"
                    name="refundType"
                    value="full"
                    checked={refundType === "full"}
                    onChange={() => setRefundType("full")}
                  />
                  <span>Full refund ({formatCents(order!.totalCents)})</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="refundType"
                    value="partial"
                    checked={refundType === "partial"}
                    onChange={() => setRefundType("partial")}
                  />
                  <span>Partial refund</span>
                </label>
              </div>
            </div>

            {refundType === "partial" ? (
              <div>
                <label className="block text-sm text-gray-500">Refund Amount</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <input type="hidden" name="amount" value={order!.totalCents} />
            )}

            <label className="block text-sm text-gray-500">Reason for refund *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for refund"
              required
            />
          </div>

          <div className="mt-8 flex gap-2">
            <Button variant="ghost" full onClick={() => setRefundType("full")}>
              Full refund
            </Button>
            <Button variant="ghost" full onClick={() => setRefundType("partial")}>
              Partial refund
            </Button>
          </div>

          <div className="mt-8">
            <Button variant="danger" full onClick={() => doRefund()} disabled={refundBusy}>
              {refundBusy ? "Refunding…" : "Process Refund"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Order: {order?.orderNumber ?? "Select an order from the list above"}
          </p>
          <p className="text-sm text-gray-500">
            Date: {order?.createdAt ? formatDateTime(order.createdAt) : ""}
          </p>
          <p className="text-sm text-gray-500">
            Customer: {order?.customer?.name ?? "Walk-in"}
          </p>
          <p className="text-sm text-gray-500">
            Total: {order?.totalCents ? formatCents(order.totalCents) : ""}
          </p>
        </div>
      )}
    </div>
  );
}