import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError, checkout, deliverReceipt, listCategories, listCustomers, listProducts, lookupBarcode, requestOverride } from "~/lib/api";
import { formatCents, formatDateTime, newIdempotencyKey, parseToCents } from "~/lib/format";
import { discountOverThreshold, splitOverpayAllowed, validEmail, validPhone } from "~/lib/posRules";
import { useAuth } from "~/shared/hooks/useAuth";
import { useCart } from "~/shared/hooks/useCart";
import { useShift } from "~/shared/hooks/useShift";
import { useToast } from "~/shared/hooks/useToast";
import { Badge } from "~/shared/components/ui/Badge";
import { Button } from "~/shared/components/ui/Button";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import { Modal } from "~/shared/components/ui/Modal";
import type { Category, Customer, PaymentMethod, Product } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Register — POS Terminal" }];
}

const QUICK_CASH = [0, 2000, 5000, 10000];
// WALLET stays out of split rows (rare combo + server support unconfirmed).
const METHODS: PaymentMethod[] = ["CASH", "CARD", "QR"];
type PayTab = PaymentMethod | "SPLIT";

interface TenderRow {
  method: PaymentMethod;
  amount: string;
}

export default function Register(): JSX.Element {
  const { lines, totals, count, add, inc, dec, setQty, remove, clear, setDiscount } = useCart();
  const { push } = useToast();
  const { demoMode } = useAuth();
  const { shift, loading: shiftLoading, refresh: refreshShift } = useShift();
  const navigate = useNavigate();
  const shiftOpen = !!shift && shift.status === "OPEN";
  // WALLET tab only exists in demo mode until @api lands it in paymentInputSchema.
  const payTabs: PayTab[] = demoMode
    ? ["CASH", "CARD", "QR", "WALLET", "SPLIT"]
    : ["CASH", "CARD", "QR", "SPLIT"];

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

  const lowStockCount = useMemo(() => products.filter((p) => p.stock <= p.lowStockThreshold).length, [products]);
  const activeCategoryName = catId ? (categories.find((c) => c.id === catId)?.name ?? "") : "";

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
      <div className="flex w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="p-3">
          <Input
            ref={searchRef}
            placeholder="Search or scan… (F2)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSearchEnter();
            }}
            aria-label="Search products"
          />
          <p className="mt-1 px-1 text-[11px] text-gray-400">F2 search · F3 customer · F4 discount · Enter adds barcode</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <button
            onClick={() => setCatId("")}
            aria-current={catId === "" ? "true" : undefined}
            className={`mb-1 flex w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm ${catId === "" ? "border-emerald-700 bg-gray-100 font-medium text-gray-900" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
          >
            All items
            <span className="text-xs text-gray-500">{products.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              aria-current={catId === c.id ? "true" : undefined}
              className={`mb-1 flex w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm ${catId === c.id ? "border-emerald-700 bg-gray-100 font-medium text-gray-900" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="truncate">{c.name}</span>
              {typeof c.productCount === "number" ? <span className="text-xs text-gray-500">{c.productCount}</span> : null}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-200 p-3 text-[13px] text-gray-600">
          {lowStockCount > 0 ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="size-1.5 rounded-full bg-red-600" />
              <Badge tone="LOW">{lowStockCount} low stock</Badge>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />
              <span className="text-gray-500">Stock healthy</span>
            </span>
          )}
        </div>
      </div>

      {/* Center — product grid (shift-gated) */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4">
        {shiftLoading ? (
          <Spinner />
        ) : !shiftOpen ? (
          <div className="pt-16">
            <EmptyState
              title="No open shift — sales are blocked until you open one."
              action={<Button variant="primary" onClick={() => navigate("/shift")}>Open shift</Button>}
            />
          </div>
        ) : loading ? (
          <Spinner />
        ) : loadError ? (
          <EmptyState title={loadError} action={<Button onClick={() => void load()}>Retry</Button>} />
        ) : products.length === 0 ? (
          <EmptyState
            title={catId || debouncedQ ? "No products match. Try another search →" : "No products yet. Add one in Products →"}
          />
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-gray-500">
                {products.length} {products.length === 1 ? "item" : "items"}
                {activeCategoryName ? ` · ${activeCategoryName}` : ""}
              </p>
              <p className="text-[11px] text-gray-400">Tap a tile to add · F2 search</p>
            </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((p) => {
              const low = p.stock <= p.lowStockThreshold;
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addWithStockCheck(p)}
                  disabled={out}
                  title={out ? `${p.name} — out of stock` : `Add ${p.name} to cart`}
                  className="pos-tile rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-gray-400">{p.sku}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[15px] font-semibold tabular-nums text-emerald-800">{formatCents(p.priceCents)}</span>
                    {out ? (
                      <Badge tone="LOW">Out</Badge>
                    ) : low ? (
                      <Badge tone="LOW">{p.stock} left</Badge>
                    ) : (
                      <span className="text-xs tabular-nums text-gray-400">×{p.stock}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        )}
      </div>

      {/* Right cart — 380px */}
      <div className="flex w-[380px] shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current sale</p>
            <span className="text-xs tabular-nums text-gray-400">{count} {count === 1 ? "item" : "items"}</span>
          </div>
          <div className="flex gap-2">
            <select
              ref={custRef}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm"
              aria-label="Customer"
            >
              <option value="">Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
            <input
              ref={discRef}
              value={discValue}
              onChange={(e) => setDiscValue(e.target.value)}
              onBlur={commitDiscount}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDiscount();
              }}
              placeholder={discMode === "PCT" ? "% disc" : "₱ disc"}
              className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm tabular-nums"
              aria-label="Discount"
            />
            <button
              onClick={() => setDiscMode((m) => (m === "PCT" ? "FIX" : "PCT"))}
              className="h-9 w-10 shrink-0 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50"
              aria-label="Toggle discount mode"
              title={approvedDisc ? "Manager approved — changes above the limit re-ask the PIN" : "Toggle % / fixed amount"}
            >
              {discMode === "PCT" ? "%" : "₱"}
            </button>
          </div>
          {selectedCustomer ? (
            <p className="mt-1 truncate text-xs text-gray-500">
              Member · {selectedCustomer.name} — {selectedCustomer.loyaltyPoints} pts
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Cart is empty.<br />Tap a product to add it.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {lines.map((l) => (
                <li key={l.product.id} className="flex items-center gap-2 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => dec(l.product.id)} className="flex size-7 items-center justify-center rounded-md border border-gray-300 text-sm hover:bg-gray-50" aria-label={`Decrease ${l.product.name}`}>−</button>
                    <input
                      value={l.qty}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (e.target.value.trim() === "" || !Number.isFinite(raw)) return;
                        const n = Math.floor(raw);
                        if (n <= 0) {
                          if (window.confirm(`Remove ${l.product.name} from the cart?`)) remove(l.product.id);
                          return;
                        }
                        if (n > l.product.stock) {
                          push("error", `Only ${l.product.stock} × ${l.product.name} in stock (FR-19).`);
                          setQty(l.product.id, l.product.stock);
                          return;
                        }
                        setQty(l.product.id, n);
                      }}
                      className="h-7 w-10 rounded-md border border-gray-300 text-center text-sm tabular-nums"
                      aria-label={`${l.product.name} quantity`}
                    />
                    <button
                      onClick={() => {
                        if (l.qty >= l.product.stock) {
                          push("error", `Only ${l.product.stock} × ${l.product.name} in stock (FR-19).`);
                          return;
                        }
                        inc(l.product.id);
                      }}
                      className="flex size-7 items-center justify-center rounded-md border border-gray-300 text-sm hover:bg-gray-50"
                      aria-label={`Increase ${l.product.name}`}
                    >+</button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{l.product.name}</p>
                    <p className="text-xs tabular-nums text-gray-500">{formatCents(l.product.priceCents)} each</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-gray-900">{formatCents(l.product.priceCents * l.qty)}</span>
                  <button onClick={() => remove(l.product.id)} className="px-1 text-gray-400 hover:text-red-600" aria-label={`Remove ${l.product.name}`}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 p-4">
          <dl className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
            <div className="flex justify-between text-gray-600"><dt>Tax</dt><dd>{formatCents(totals.taxCents)}</dd></div>
            {totals.discountCents > 0 ? (
              <div className="flex justify-between text-gray-600">
                <dt>Discount{approvedDisc ? " (mgr)" : ""}</dt>
                <dd>−{formatCents(totals.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-xl font-semibold tracking-tight">
              <dt className="text-gray-900">Total</dt>
              <dd className="text-emerald-800" aria-live="polite">{formatCents(totals.totalCents)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={clear} disabled={lines.length === 0}>Clear</Button>
            <Button
              variant="primary"
              size="lg"
              full
              onClick={() => {
                if (!shiftOpen) {
                  navigate("/shift");
                  return;
                }
                setPayOpen(true);
              }}
              disabled={lines.length === 0 || !shiftOpen}
            >
              {shiftOpen ? (
                <span className="inline-flex items-center gap-2">Charge {formatCents(totals.totalCents)} <kbd className="kbd">F8</kbd></span>
              ) : (
                "Open shift first"
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            {count} {count === 1 ? "item" : "items"}
            {shift ? (
              <>
                {" · "}
                <Link to="/shift" className="text-gray-500 underline-offset-2 hover:underline">
                  Shift open since {formatDateTime(shift.startedAt ?? shift.createdAt ?? "")}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Manager PIN for over-threshold discount (FR-28) */}
      {pinOpen ? (
        <Modal title="Manager approval needed" onClose={() => setPinOpen(false)}>
          <p className="mb-3 text-sm text-gray-600">
            This discount exceeds the cashier limit (10% or {formatCents(50000)}). Ask a manager for their PIN.
          </p>
          <Input
            label="Manager PIN"
            type="password"
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
            <Button variant="ghost" full onClick={() => setPinOpen(false)}>Cancel · Esc</Button>
            <Button variant="primary" full onClick={() => void approvePin()} disabled={pinBusy}>
              {pinBusy ? "Checking…" : "Approve"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* Payment sheet */}
      {payOpen ? (
        <Modal title={`Charge ${formatCents(totals.totalCents)}`} onClose={() => setPayOpen(false)}>
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Payment method">
            {payTabs.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={payTab === m}
                onClick={() => setPayTab(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${payTab === m ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {m}
              </button>
            ))}
          </div>

          {payTab === "CASH" ? (
            <>
              <Input label="Cash tendered" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="0.00" autoFocus />
              <div className="mt-2 flex gap-2">
                {QUICK_CASH.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTendered(c === 0 ? (totals.totalCents / 100).toFixed(2) : (c / 100).toFixed(2))}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm hover:bg-gray-50"
                  >
                    {c === 0 ? "Exact" : formatCents(c)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm tabular-nums text-gray-600">
                Change due: <span className="font-semibold text-emerald-800">{formatCents(Math.max(0, tenderedCents - totals.totalCents))}</span>
              </p>
            </>
          ) : payTab === "SPLIT" ? (
            <div>
              {tenders.map((t, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <select
                    value={t.method}
                    onChange={(e) =>
                      setTenders((prev) => prev.map((row, j) => (j === i ? { ...row, method: e.target.value as PaymentMethod } : row)))
                    }
                    className="h-10 w-24 shrink-0 rounded-lg border border-gray-300 bg-white px-2 text-sm"
                    aria-label={`Tender ${i + 1} method`}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={t.amount}
                      onChange={(e) => setTenders((prev) => prev.map((row, j) => (j === i ? { ...row, amount: e.target.value } : row)))}
                      placeholder="0.00"
                      aria-label={`Tender ${i + 1} amount`}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-gray-500">
                    {formatCents(parseToCents(t.amount || "0"))}
                  </span>
                  {tenders.length > 2 ? (
                    <button
                      onClick={() => setTenders((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 px-1 text-gray-400 hover:text-red-600"
                      aria-label={`Remove tender ${i + 1}`}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                onClick={() => setTenders((prev) => [...prev, { method: "QR", amount: "" }])}
                disabled={tenders.length >= 4}
                className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                + Add tender ({tenders.length}/4)
              </button>
              <p className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, totals.totalCents > 0 ? (splitSum / totals.totalCents) * 100 : 0)}%` }}
                />
              </p>
              <p className={`mt-2 text-sm tabular-nums ${splitRemaining === 0 ? "text-emerald-800" : splitRemaining > 0 ? "text-gray-600" : "text-red-700"}`}>
                {splitRemaining > 0
                  ? `Collected ${formatCents(splitSum)} — ${formatCents(splitRemaining)} still due`
                  : splitRemaining < 0
                    ? splitOverpayAllowed(splitRows, totals.totalCents)
                      ? `Change due: ${formatCents(-splitRemaining)} (cash)`
                      : "Only a cash tender may overpay (BR-04)"
                    : `Covered: ${formatCents(splitSum)}`}
              </p>
            </div>
          ) : (
            <Input label={`${payTab} reference`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={payTab === "CARD" ? "Auth code / last 4" : payTab === "WALLET" ? "Wallet txn ID" : "QR ref"} autoFocus />
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" full onClick={() => setPayOpen(false)}>Cancel · Esc</Button>
            <Button variant="primary" size="lg" full onClick={() => void doCharge()} disabled={!canCharge || charging}>
              {charging
                ? "Charging…"
                : payTab === "CASH" && tenderedCents < totals.totalCents
                  ? "Enter tendered"
                  : payTab === "SPLIT" && splitRemaining > 0
                    ? `${formatCents(splitRemaining)} due`
                    : `Confirm ${formatCents(totals.totalCents)}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {receipt ? (
        <Modal title="Payment complete" onClose={() => setReceipt(null)}>
          <div className="receipt-print text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-800">✓</span>
            <p className="text-sm tabular-nums text-gray-500">{receipt.orderNumber}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{formatCents(receipt.totalCents)}</p>
            <p className="mt-1 text-sm text-gray-600">Change due: <span className="font-semibold tabular-nums text-emerald-800">{formatCents(receipt.changeCents)}</span></p>
            {receipt.memberName ? (
              <p className="mt-2 text-sm text-gray-600">
                Member: <span className="font-medium text-gray-900">{receipt.memberName}</span>
                {receipt.memberPoints != null ? (
                  <span className="tabular-nums"> · {receipt.memberPoints} pts</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="no-print mt-3 rounded-lg border border-gray-200 p-3">
            <p className="text-left text-[13px] font-medium text-gray-700">Send receipt</p>
            <div className="mt-1.5 flex gap-2">
              <input
                value={delivTarget}
                onChange={(e) => setDelivTarget(e.target.value)}
                placeholder="Email or phone"
                className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-700 focus:outline-none"
                aria-label="Receipt destination"
              />
              <Button size="sm" variant="secondary" onClick={() => void deliver("EMAIL")} disabled={delivBusy !== null}>
                {delivBusy === "EMAIL" ? "…" : "Email"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void deliver("SMS")} disabled={delivBusy !== null}>
                {delivBusy === "SMS" ? "…" : "SMS"}
              </Button>
            </div>
            <p className="mt-1 text-left text-[11px] text-gray-400">Email or SMS delivery — queues locally while in demo mode.</p>
          </div>
          <div className="no-print mt-4 flex gap-2">
            <Button variant="secondary" full onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button variant="primary" full onClick={() => setReceipt(null)}>New sale</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
