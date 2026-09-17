import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useNavigate } from "react-router";
import { ApiError, checkout, deliverReceipt, listCategories, listCustomers, listProducts, lookupBarcode, requestOverride } from "~/lib/api";
import { formatCents, newIdempotencyKey, parseToCents } from "~/lib/format";
import { discountOverThreshold, splitOverpayAllowed, validEmail, validPhone } from "~/lib/posRules";
import { useAuth } from "~/shared/hooks/useAuth";
import { useCart } from "~/shared/hooks/useCart";
import { useShift } from "~/shared/hooks/useShift";
import { useSocket } from "~/shared/hooks/useSocket";
import { useThermalPrint } from "~/shared/hooks/useThermalPrint";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { CartLine } from "~/shared/components/ui/CartLine";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import { Modal } from "~/shared/components/ui/Modal";
import { ProductTile } from "~/shared/components/ui/ProductTile";
import { Select } from "~/shared/components/ui/Select";
import type { Category, Customer, PaymentMethod, Product } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Register — Point of Sale" }];
}

const QUICK_CASH = [0, 2000, 5000, 10000];
type PayTab = PaymentMethod | "SPLIT";

interface TenderRow {
  method: PaymentMethod;
  amount: string;
}

export default function Register(): JSX.Element {
  const { lines, totals, add, inc, dec, setQty, remove, clear, setDiscount } = useCart();
  const { push } = useToast();
  const { demoMode } = useAuth();
  const { shift, loading: shiftLoading } = useShift();
  const navigate = useNavigate();
  const shiftOpen = !!shift && shift.status === "OPEN";

  // Real-time socket for order:created, stock:low, session:revoked
  const storeId = shift?.storeId ?? null;
  useSocket({
    storeId: storeId ?? undefined,
    onStockLow: (data) => {
      push("warning", `⚠️ Low stock: ${data.productName} (${data.currentStock} left)`);
      void load(); // refresh product list
    },
    onOrderCreated: (data) => {
      if (data.itemCount > 0) {
        push("info", `📦 New order: ${data.orderNumber} (${data.itemCount} items)`);
      }
    },
    onSessionRevoked: () => {
      push("error", "Your session was revoked. Please log in again.");
      navigate("/login", { replace: true });
    },
  });

  // Thermal printer support
  const { printing: thermalPrinting, printOrder: thermalPrintOrder } = useThermalPrint();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catId, setCatId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");

  // Discount — % or fixed cents; over-threshold needs a manager PIN (FR-27/28).
  const [discValue, setDiscValue] = useState("");
  const [discMode, setDiscMode] = useState<"PCT" | "FIX">("PCT");
  const [approvedDisc, setApprovedDisc] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const pendingDiscRef = useRef(0);
  // Receipt delivery (FR-31) — endpoint pending @api; degrades honestly.
  const [delivTarget, setDelivTarget] = useState("");
  const [delivBusy, setDelivBusy] = useState<"EMAIL" | "SMS" | null>(null);

  // Payment sheet — single method or split across up to 4 tenders (FR-23).
  const [payOpen, setPayOpen] = useState(false);
  const [payTab, setPayTab] = useState<PayTab>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [tenders, setTenders] = useState<TenderRow[]>([
    { method: "CASH", amount: "" },
    { method: "CARD", amount: "" },
  ]);
  const [charging, setCharging] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderId: string;
    orderNumber: string;
    changeCents: number;
    totalCents: number;
    memberName: string | null;
    memberPoints: number | null;
    memberEmail: string | null;
    memberPhone: string | null;
  } | null>(null);
  // One idempotency key per cart session — retries reuse it, success regenerates it.
  const idemRef = useRef(newIdempotencyKey());

  const searchRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);
  const custRef = useRef<HTMLSelectElement>(null);
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [cats, prods, custs] = await Promise.all([
        listCategories(),
        listProducts({ q: debouncedQ || undefined, categoryId: catId || undefined, pageSize: 200 }),
        listCustomers().catch(() => ({ data: [], page: 1, pageSize: 50, total: 0 })),
      ]);
      setCategories(cats);
      setProducts(prods.data);
      setCustomers(custs.data);
    } catch {
      setLoadError("Failed to load catalog. Check connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, catId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keyboard: F2 search, F3 customer, F4 discount, F8 charge (open shift only), Esc close (via Modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "F3") {
        e.preventDefault();
        custRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        discRef.current?.focus();
        discRef.current?.select();
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (lines.length > 0 && shiftOpen && !payOpen && !receipt && !pinOpen) setPayOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines.length, payOpen, receipt, pinOpen, shiftOpen]);

  function addWithStockCheck(p: Product): void {
    if (p.stock <= 0) {
      push("error", `${p.name} is out of stock`);
      return;
    }
    const existing = lines.find((l) => l.product.id === p.id);
    if (existing && existing.qty >= p.stock) {
      push("error", `Only ${p.stock} × ${p.name} in stock (FR-19).`);
      return;
    }
    add(p);
  }

  async function onSearchEnter(): Promise<void> {
    const code = query.trim();
    if (!code) return;
    // Barcode fast-path: exact SKU/barcode → add immediately (with stock check)
    const direct = await lookupBarcode(code).catch(() => null);
    if (direct) {
      addWithStockCheck(direct);
      setQuery("");
      if (direct.stock > 0) push("success", `${direct.name} added`);
    }
  }

  function computeDiscountCents(cap: number): number {
    if (discMode === "PCT") {
      const pct = Number(discValue.replace(/[^0-9.]/g, "")) || 0;
      return Math.max(0, Math.min(cap, Math.round((cap * Math.min(100, pct)) / 100)));
    }
    return Math.max(0, Math.min(cap, parseToCents(discValue || "0")));
  }

  function commitDiscount(): void {
    const cap = totals.subtotalCents + totals.taxCents;
    const cents = computeDiscountCents(cap);
    if (cents > 0 && discountOverThreshold(cents, cap) && !approvedDisc) {
      pendingDiscRef.current = cents;
      setPinOpen(true);
      return;
    }
    setDiscount(cents);
  }

  async function approvePin(): Promise<void> {
    if (!/^\d{4,8}$/.test(pinValue)) {
      push("error", "Enter the manager PIN (4-8 digits).");
      return;
    }
    setPinBusy(true);
    try {
      // In live mode the server verifies the PIN; demo mode approves locally.
      if (!demoMode) await requestOverride(pinValue);
      setApprovedDisc(true);
      setDiscount(pendingDiscRef.current);
      setPinOpen(false);
      setPinValue("");
      push("success", "Manager approved over-limit discount");
    } catch {
      push("error", "Invalid manager PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  async function deliver(channel: "EMAIL" | "SMS"): Promise<void> {
    if (!receipt || delivBusy) return;
    const target = delivTarget.trim();
    if (channel === "EMAIL" && !validEmail(target)) {
      push("error", "Enter a valid email address.");
      return;
    }
    if (channel === "SMS" && !validPhone(target)) {
      push("error", "Enter a valid phone number (7+ digits).");
      return;
    }
    setDelivBusy(channel);
    try {
      const res = await deliverReceipt(receipt.orderId, channel, target);
      push(
        "success",
        res.demo
          ? `Receipt queued locally (demo) — ${channel.toLowerCase()} → ${target}`
          : `${channel === "EMAIL" ? "Email" : "SMS"} receipt sent to ${target}`,
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === "FEATURE_NOT_LIVE") {
        push("error", `Receipt ${channel.toLowerCase()} isn't available on this server yet.`);
      } else {
        push("error", "Delivery failed. Try again.");
      }
    } finally {
      setDelivBusy(null);
    }
  }

  const tenderedCents = parseToCents(tendered || "0");
  const splitRows = useMemo(
    () =>
      payTab === "SPLIT"
        ? tenders
            .map((t) => ({ method: t.method, amountCents: parseToCents(t.amount || "0") }))
            .filter((t) => t.amountCents > 0)
        : [],
    [payTab, tenders],
  );
  const splitSum = splitRows.reduce((s, t) => s + t.amountCents, 0);
  const splitRemaining = totals.totalCents - splitSum;
  const splitValid =
    splitRows.length >= 2 &&
    splitRemaining <= 0 &&
    (splitRemaining === 0 || splitOverpayAllowed(splitRows, totals.totalCents));
  const canCharge =
    totals.totalCents > 0 &&
    shiftOpen &&
    (payTab === "CASH"
      ? tenderedCents >= totals.totalCents
      : payTab === "SPLIT"
        ? splitValid
        : true);

  async function doCharge(): Promise<void> {
    if (charging || !shiftOpen) return;
    if (payTab === "WALLET" && !demoMode) {
      push("error", "Wallet payments aren't supported by the server yet.");
      return;
    }
    // Commit discount at charge time (input may not have blurred yet).
    const cap = totals.subtotalCents + totals.taxCents;
    const d = computeDiscountCents(cap);
    if (d > 0 && discountOverThreshold(d, cap) && !approvedDisc) {
      pendingDiscRef.current = d;
      setPinOpen(true);
      return;
    }
    setDiscount(d);
    const finalTotal = Math.max(0, cap - d);

    if (payTab === "SPLIT") {
      if (splitRows.length < 2) {
        push("error", "Split needs at least 2 tenders with amounts.");
        return;
      }
      if (splitRemaining > 0) {
        push("error", `${formatCents(splitRemaining)} still due.`);
        return;
      }
      if (!splitOverpayAllowed(splitRows, finalTotal)) {
        push("error", "Only cash tenders can overpay (change is returned on cash).");
        return;
      }
    }
    if (payTab === "CASH" && tenderedCents < finalTotal) return;

    setCharging(true);
    try {
      const { order, changeCents } = await checkout(
        {
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
          payments: payTab === "SPLIT"
            ? splitRows
            : payTab === "CASH"
              ? [{ method: "CASH" as const, amountCents: tenderedCents }]
              : [{ method: payTab as PaymentMethod, amountCents: finalTotal, reference: reference || undefined }],
          customerId: customerId || undefined,
          discountCents: d,
          note: note || undefined,
        },
        idemRef.current,
      );
      const offline = order.id.startsWith("o-local-") || order.orderNumber.startsWith("ORD-LOCAL-");
      const memEmail = order.customer?.email ?? selectedCustomer?.email ?? null;
      const memPhone = order.customer?.phone ?? selectedCustomer?.phone ?? null;
      setReceipt({
        orderId: order.id,
        orderNumber: order.orderNumber,
        changeCents,
        totalCents: order.totalCents,
        memberName: order.customer?.name ?? selectedCustomer?.name ?? null,
        memberPoints: order.customer?.loyaltyPoints ?? selectedCustomer?.loyaltyPoints ?? null,
        memberEmail: memEmail,
        memberPhone: memPhone,
      });
      setDelivTarget(memEmail ?? memPhone ?? "");
      setPayOpen(false);
      clear();
      idemRef.current = newIdempotencyKey();
      setTendered("");
      setReference("");
      setTenders([
        { method: "CASH", amount: "" },
        { method: "CARD", amount: "" },
      ]);
      setCustomerId("");
      setNote("");
      setDiscValue("");
      setApprovedDisc(false);
      push("success", offline ? `Saved offline (demo) — ${order.orderNumber}` : `Charged ${formatCents(order.totalCents)} · ${order.orderNumber}`);
      void load();
    } catch {
      push("error", "Checkout failed. Try again.");
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left rail — 240px */}
      <div className="flex w-[240px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="p-3">
          <Input
            ref={searchRef}
            placeholder="Search or scan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSearchEnter();
            }}
            aria-label="Search products"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <button
            onClick={() => setCatId("")}
            aria-current={catId === "" ? "true" : undefined}
            className={`mb-1 flex w-full items-center justify-between px-3 py-2 text-sm ${catId === "" ? "border-l-2 border-emerald-700 bg-[var(--color-surface-hover)] font-medium text-[var(--color-text)]" : "border-transparent text-[var(--color-neutral-700)] hover:bg-[var(--color-surface)]"}`}
          >
            All items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              aria-current={catId === c.id ? "true" : undefined}
              className={`mb-1 flex w-full items-center px-3 py-2 text-sm ${catId === c.id ? "border-l-2 border-emerald-700 bg-[var(--color-surface-hover)] font-medium text-[var(--color-text)]" : "border-transparent text-[var(--color-neutral-700)] hover:bg-[var(--color-surface)]"}`}
            >
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center — product grid (shift-gated) */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-surface)] p-4">
        {shiftLoading ? (
          <Spinner />
        ) : !shiftOpen ? (
          <div className="pt-16">
            <EmptyState
              title="Open a shift to start selling"
              action={<Button variant="primary" onClick={() => navigate("/shift")}>Open shift</Button>}
            />
          </div>
        ) : loading ? (
          <Spinner />
        ) : loadError ? (
          <EmptyState title={loadError} action={<Button onClick={() => void load()}>Retry</Button>} />
        ) : products.length === 0 ? (
          <EmptyState title={catId || debouncedQ ? "No products match" : "No products. Add one in Products"} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((p) => (
              <ProductTile key={p.id} product={p} onAdd={addWithStockCheck} />
            ))}
          </div>
        )}
      </div>

      {/* Right cart — 380px */}
      <div className="flex w-[380px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="border-b border-[var(--color-border)] p-3">
          <div className="flex gap-2">
            <Select
              ref={custRef}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Walk-in"
              options={[{ value: "", label: "Walk-in" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
              aria-label="Customer"
            />
            <Input
              ref={discRef}
              value={discValue}
              onChange={(e) => setDiscValue(e.target.value)}
              onBlur={commitDiscount}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDiscount();
              }}
              placeholder="% disc"
              className="h-9 w-20 text-sm tabular-nums"
              aria-label="Discount"
            />
            <button
              onClick={() => setDiscMode((m) => (m === "PCT" ? "FIX" : "PCT"))}
              className="h-9 w-10 shrink-0 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
              aria-label="Toggle discount mode"
            >
              {discMode === "PCT" ? "%" : "₱"}
            </button>
          </div>
          {selectedCustomer && (
            <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{selectedCustomer.name}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">Cart empty</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]" role="list" aria-label="Cart items">
              {lines.map((l) => (
                <CartLine
                  key={l.product.id}
                  line={l}
                  onInc={inc}
                  onDec={dec}
                  onSetQty={setQty}
                  onRemove={remove}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] p-4">
          <dl className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between"><dd>{formatCents(totals.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dd>{formatCents(totals.taxCents)}</dd></div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between text-[var(--color-danger)]"><dd>−{formatCents(totals.discountCents)}</dd></div>
            )}
            <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-xl font-semibold">
              <dd className="text-[var(--color-success)]" aria-live="polite">{formatCents(totals.totalCents)}</dd>
            </div>
          </dl>
          <Button
            variant="primary"
            size="lg"
            full
            loading={charging}
            onClick={() => {
              if (!shiftOpen) { navigate("/shift"); return; }
              setPayOpen(true);
            }}
            disabled={lines.length === 0 || !shiftOpen}
          >
            Charge {formatCents(totals.totalCents)} <kbd className="kbd">F8</kbd>
          </Button>
        </div>
      </div>

      {/* Manager PIN for over-threshold discount (FR-28) */}
      {pinOpen ? (
        <Modal title="Manager approval needed" onClose={() => setPinOpen(false)}>
          <Input
            label="Manager PIN"
            type="password"
            passwordToggle
            inputMode="numeric"
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void approvePin();
            }}
            placeholder="••••"
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" full onClick={() => setPinOpen(false)}>Cancel</Button>
            <Button variant="primary" full onClick={() => void approvePin()} loading={pinBusy}>
              {pinBusy ? "Checking…" : "Approve"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* Payment sheet */}
      {payOpen ? (
        <Modal title={formatCents(totals.totalCents)} onClose={() => setPayOpen(false)}>
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Payment method">
            {(["CASH", "CARD", "QR", "SPLIT"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={payTab === m}
                onClick={() => setPayTab(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${payTab === m ? "border-[var(--color-primary)] bg-[var(--color-success)]/10 text-[var(--color-success)]" : "border-[var(--color-border)] text-[var(--color-neutral-700)] hover:bg-[var(--color-surface)]"}`}
              >
                {m}
              </button>
            ))}
          </div>

          {payTab === "CASH" ? (
            <>
              <Input value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="0.00" autoFocus />
              <div className="mt-2 flex gap-2">
                {QUICK_CASH.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTendered(c === 0 ? (totals.totalCents / 100).toFixed(2) : (c / 100).toFixed(2))}
                    className="flex-1 rounded-lg border border-[var(--color-border)] px-2 py-2 text-sm hover:bg-[var(--color-surface)]"
                  >
                    {c === 0 ? "Exact" : formatCents(c)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm tabular-nums text-[var(--color-success)] font-semibold">
                {formatCents(Math.max(0, tenderedCents - totals.totalCents))}
              </p>
            </>
          ) : payTab === "SPLIT" ? (
            <div>
              {tenders.map((t, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <Select
                    value={t.method}
                    onChange={(method) => setTenders((prev) => prev.map((row, j) => (j === i ? { ...row, method: method as PaymentMethod } : row)))}
                    options={["CASH", "CARD", "QR"].map((m) => ({ value: m, label: m }))}
                    aria-label={`Tender ${i + 1} method`}
                    className="h-10 w-24 shrink-0"
                  />
                  <Input
                    value={t.amount}
                    onChange={(e) => setTenders((prev) => prev.map((row, j) => (j === i ? { ...row, amount: e.target.value } : row)))}
                    placeholder="0.00"
                    aria-label={`Tender ${i + 1} amount`}
                    className="flex-1"
                  />
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-[var(--color-text-muted)]">
                    {formatCents(parseToCents(t.amount || "0"))}
                  </span>
                  {tenders.length > 2 && (
                    <button
                      onClick={() => setTenders((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 px-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      aria-label={`Remove tender ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setTenders((prev) => [...prev, { method: "QR", amount: "" }])}
                disabled={tenders.length >= 4}
                className="w-full rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-50"
              >
                + Add tender
              </button>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--color-surface-hover)]">
                <span
                  className="block h-full bg-[var(--color-success)] transition-all"
                  style={{ width: `${Math.min(100, totals.totalCents > 0 ? (splitSum / totals.totalCents) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-sm tabular-nums" style={{ color: splitRemaining > 0 ? "var(--color-text-muted)" : splitRemaining < 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                {splitRemaining > 0
                  ? `${formatCents(splitSum)} / ${formatCents(totals.totalCents)}`
                  : splitRemaining < 0
                    ? `Change ${formatCents(-splitRemaining)}`
                    : "Covered"}
              </p>
            </div>
          ) : (
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" autoFocus />
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" full onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button variant="primary" size="lg" full onClick={() => void doCharge()} loading={charging} disabled={!canCharge}>
              {payTab === "CASH" && tenderedCents < totals.totalCents
                ? "Enter amount"
                : `Confirm ${formatCents(totals.totalCents)}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {receipt ? (
        <Modal title=" " onClose={() => setReceipt(null)}>
          <div className="receipt-print text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-xl text-[var(--color-success)]">✓</span>
            <p className="text-sm tabular-nums text-[var(--color-text-muted)]">{receipt.orderNumber}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{formatCents(receipt.totalCents)}</p>
            <p className="mt-1 text-sm tabular-nums text-[var(--color-success)] font-semibold">{formatCents(receipt.changeCents)}</p>
          </div>
          <div className="no-print mt-3 p-3">
            <div className="flex gap-2">
              <Input
                value={delivTarget}
                onChange={(e) => setDelivTarget(e.target.value)}
                placeholder="Email or phone"
                className="h-10 min-w-0 flex-1"
                aria-label="Receipt destination"
              />
              <Button size="sm" variant="secondary" onClick={() => void deliver("EMAIL")} disabled={delivBusy !== null} aria-label="Email receipt">
                ✉
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void deliver("SMS")} disabled={delivBusy !== null} aria-label="SMS receipt">
                📱
              </Button>
            </div>
          </div>
          <div className="no-print mt-4 flex gap-2">
            <Button variant="secondary" full onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="secondary"
              full
              onClick={() => void thermalPrintOrder(receipt.orderId, { format: "escpos", cutPaper: true })}
              loading={thermalPrinting}
              disabled={thermalPrinting}
            >
              {thermalPrinting ? "Printing…" : "Thermal"}
            </Button>
            <Button variant="primary" full onClick={() => setReceipt(null)}>
              Next
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

