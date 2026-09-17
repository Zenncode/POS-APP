import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { Link, useNavigate } from "react-router";
import { listOrders } from "~/lib/api";
import { formatCents, formatDateTime } from "~/lib/format";
import {
  DENOMINATIONS_CENTS,
  expectedCashCents,
  floatCents,
  toCounts,
  VARIANCE_NOTE_MAX_CENTS,
  varianceCents,
} from "~/lib/posRules";
import { useAuth } from "~/shared/hooks/useAuth";
import { useShift } from "~/shared/hooks/useShift";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import type { Order, Shift } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Shift — Point of Sale" }];
}

function shiftStartIso(s: Shift): string {
  return s.startedAt ?? s.createdAt ?? new Date().toISOString();
}

function FloatGrid({
  values,
  onChange,
}: {
  values: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {DENOMINATIONS_CENTS.map((d) => (
        <div
          key={d}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
        >
          <span className="text-sm tabular-nums text-[var(--color-neutral-700)]">{formatCents(d)}</span>
          <div className="w-20 shrink-0">
            <Input
              id={`float-${d}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={values[d] ?? ""}
              placeholder="0"
              aria-label={`Count of ${formatCents(d)} bills/coins`}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                onChange({ ...values, [d]: n });
              }}
              className="text-center tabular-nums"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const DEVICE_LABELS = [
  { key: "scanner", label: "Barcode scanner" },
  { key: "printer", label: "Receipt printer" },
  { key: "reader", label: "Card / QR reader" },
] as const;

export default function ShiftScreen(): JSX.Element {
  const { shift, loading, error, refresh, open, close } = useShift();
  const { signOut } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [devices, setDevices] = useState<Record<"scanner" | "printer" | "reader", boolean>>({
    scanner: true,
    printer: true,
    reader: true,
  });
  const [busy, setBusy] = useState(false);

  const floatTotal = useMemo(() => floatCents(toCounts(counts)), [counts]);

  // Close mode: pull this shift's orders for expected-cash math + pending-sale guard (FR-11).
  const openSince = shift && shift.status === "OPEN" ? shiftStartIso(shift) : null;
  const [shiftOrders, setShiftOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const loadShiftOrders = useCallback(async () => {
    if (!openSince) return;
    setOrdersLoading(true);
    try {
      const res = await listOrders({ from: openSince, pageSize: 250 });
      setShiftOrders(res.data);
    } catch {
      setShiftOrders([]);
      push("error", "Couldn't load shift orders — variance will be 0.");
    } finally {
      setOrdersLoading(false);
    }
  }, [openSince, push]);

  useEffect(() => {
    void loadShiftOrders();
  }, [loadShiftOrders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openingFloatCents = shift ? floatCents(shift.openingFloat) : 0;
  const expected = expectedCashCents(openingFloatCents, shiftOrders);
  const variance = varianceCents(expected, floatTotal);
  const pending = shiftOrders.filter((o) => o.status === "PENDING");
  const sales = shiftOrders
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.totalCents, 0);
  const varianceNeedsNote = Math.abs(variance) > VARIANCE_NOTE_MAX_CENTS;

  async function doOpen(): Promise<void> {
    if (floatTotal <= 0) {
      push("error", "Enter the opening float (at least one count).");
      return;
    }
    setBusy(true);
    try {
      await open(toCounts(counts), note || undefined);
      push("success", "Shift opened — start selling (F2 to scan, F8 to charge).");
      navigate("/register");
    } catch {
      push("error", "Couldn't open the shift. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function doClose(): Promise<void> {
    if (pending.length > 0) {
      push("error", "Settle or void pending sales first — the shift can't close.");
      return;
    }
    if (varianceNeedsNote && !note.trim()) {
        push("error", "Manager note required when variance exceeds ₱100.");
      return;
    }
    setBusy(true);
    try {
      await close(toCounts(counts), note || undefined);
      push("success", `Shift closed · variance ${formatCents(variance)} — session ended.`);
    } catch {
      push("error", "Couldn't close the shift. Try again.");
      setBusy(false);
      return;
    }
    try {
      await signOut();
    } catch {
      // best effort — logout already clearTokens()s; never block the redirect
    }
    setBusy(false);
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isOpen = !!shift && shift.status === "OPEN";

  if (!isOpen) {
    // ── Open shift (FR-06/07/08) ──
    if (error) {
      return (
        <div className="p-6">
          <EmptyState title={error} action={<Button onClick={() => void refresh()}>Retry</Button>} />
        </div>
      );
    }
    const faulty = DEVICE_LABELS.filter((d) => !devices[d.key]);
    return (
      <div className="mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Open shift</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Count the drawer float before your first sale. Sales are blocked until a shift is open.
        </p>

        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--color-text)]">Opening float</p>
            <p className={`text-sm font-semibold tabular-nums ${floatTotal > 0 ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}`}>{formatCents(floatTotal)}</p>
          </div>
          <FloatGrid values={counts} onChange={setCounts} />
          {/* FR-07 */}
          {floatTotal === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Enter at least one denomination count.</p>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          {/* FR-08 */}
          <p className="text-sm font-medium text-[var(--color-text)]">Device check</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEVICE_LABELS.map((d) => (
              <button
                key={d.key}
                aria-pressed={devices[d.key]}
                onClick={() => setDevices((prev) => ({ ...prev, [d.key]: !prev[d.key] }))}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  devices[d.key]
                    ? "border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]"
                    : "border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                }`}
              >
                {d.label}: {devices[d.key] ? "OK" : "Fault"}
              </button>
            ))}
          </div>
          {faulty.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              Fault logged for: {faulty.map((f) => f.label).join(", ")}. You can still open and sell — faults appear in the Z-report.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. drawer sealed, tape #123" />
        </div>

        <Button variant="primary" size="lg" full className="mt-4" onClick={() => void doOpen()} loading={busy} disabled={floatTotal <= 0}>
          Open shift &amp; start selling
        </Button>
      </div>
    );
  }

  // ── Close shift (FR-10/11/12, UC-12) ──
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Close shift</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Started {formatDateTime(openSince ?? "")} · {shiftOrders.length} orders · {formatCents(sales)} sales.
        Closing ends your session (FR-04).
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <dt className="text-[var(--color-text-muted)]">Opening float</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-[var(--color-text)]">{formatCents(openingFloatCents)}</dd>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <dt className="text-[var(--color-text-muted)]">Expected cash</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-[var(--color-text)]">
            {ordersLoading ? "…" : formatCents(expected)}
          </dd>
        </div>
      </dl>

      {pending.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-text)]">
          {pending.length} pending sale{pending.length > 1 ? "s" : ""} must be completed or voided before closing (FR-11).{" "}
          <Link to="/orders" className="font-medium underline">
            Go to Orders
          </Link>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--color-text)]">Closing count</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{formatCents(floatTotal)}</p>
        </div>
        <FloatGrid values={counts} onChange={setCounts} />
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-neutral-100)] pt-3">
          <p className="text-sm text-[var(--color-neutral-600)]">Variance (counted − expected)</p>
          <p className={`text-sm font-semibold tabular-nums ${variance === 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
            {formatCents(variance)}
          </p>
        </div>
        {varianceNeedsNote ? (
          <p className="mt-2 text-xs text-[var(--color-warning)]">
            Variance over ₱100 — a manager note is required (UC-12).
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Input
          label={varianceNeedsNote ? "Manager note (required)" : "Note (optional)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={varianceNeedsNote ? "Explain the variance…" : "Anything to record"}
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        full
        className="mt-4"
        onClick={() => void doClose()}
        loading={busy}
        disabled={pending.length > 0 || (varianceNeedsNote && !note.trim())}
      >
        Close shift &amp; sign out
      </Button>
    </div>
  );
}

