import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { checkout, listCategories, listCustomers, listProducts, lookupBarcode } from "~/lib/api";
import { formatCents, newIdempotencyKey, parseToCents } from "~/lib/format";
import { useCart } from "~/shared/hooks/useCart";
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

export default function Register(): JSX.Element {
  const { lines, totals, count, add, inc, dec, setQty, remove, clear, setDiscount } = useCart();
  const { push } = useToast();

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
  const [discountInput, setDiscountInput] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [charging, setCharging] = useState(false);
  const [receipt, setReceipt] = useState<{ orderNumber: string; changeCents: number; totalCents: number } | null>(null);
  // One idempotency key per cart session — retries reuse it, success regenerates it.
  const idemRef = useRef(newIdempotencyKey());

  const searchRef = useRef<HTMLInputElement>(null);

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

  // Keyboard: F2 search, F8 charge, Esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (lines.length > 0 && !payOpen && !receipt) setPayOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines.length, payOpen, receipt]);

  const lowStockCount = useMemo(() => products.filter((p) => p.stock <= p.lowStockThreshold).length, [products]);

  async function onSearchEnter(): Promise<void> {
    const code = query.trim();
    if (!code) return;
    // Barcode fast-path: exact SKU/barcode → add immediately
    const direct = await lookupBarcode(code).catch(() => null);
    if (direct) {
      add(direct);
      setQuery("");
      push("success", `${direct.name} added`);
    }
  }

  function applyDiscount(): void {
    const cents = parseToCents(discountInput || "0");
    if (cents > totals.subtotalCents + totals.taxCents) {
      push("error", "Discount cannot exceed the total.");
      return;
    }
    setDiscount(cents);
  }

  const tenderedCents = parseToCents(tendered || "0");
  const canCharge = totals.totalCents > 0 && (method !== "CASH" || tenderedCents >= totals.totalCents);

  async function doCharge(): Promise<void> {
    if (!canCharge || charging) return;
    // Commit discount at charge time (input may not have blurred yet).
    const d = parseToCents(discountInput || "0");
    const cap = totals.subtotalCents + totals.taxCents;
    if (d > cap) {
      push("error", "Discount cannot exceed the total.");
      return;
    }
    setDiscount(d);
    const finalTotal = Math.max(0, cap - d);
    setCharging(true);
    try {
      const { order, changeCents } = await checkout(
        {
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
          payments: [
            method === "CASH"
              ? { method, amountCents: tenderedCents }
              : { method, amountCents: finalTotal, reference: reference || undefined },
          ],
          customerId: customerId || undefined,
          discountCents: d,
          note: note || undefined,
        },
        idemRef.current,
      );
      const offline = order.id.startsWith("o-local-") || order.orderNumber.startsWith("ORD-LOCAL-");
      setReceipt({ orderNumber: order.orderNumber, changeCents, totalCents: order.totalCents });
      setPayOpen(false);
      clear();
      idemRef.current = newIdempotencyKey();
      setTendered("");
      setReference("");
      setCustomerId("");
      setNote("");
      setDiscountInput("");
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
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <button
            onClick={() => setCatId("")}
            className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${catId === "" ? "border-l-2 border-emerald-700 bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
          >
            All items
            <span className="text-xs text-gray-500">{products.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${catId === c.id ? "border-l-2 border-emerald-700 bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="truncate">{c.name}</span>
              {typeof c.productCount === "number" ? <span className="text-xs text-gray-500">{c.productCount}</span> : null}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-200 p-3 text-[13px] text-gray-600">
          {lowStockCount > 0 ? <Badge tone="LOW">{lowStockCount} low stock</Badge> : <span className="text-gray-500">Stock healthy</span>}
        </div>
      </div>

      {/* Center — product grid */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4">
        {loading ? (
          <Spinner />
        ) : loadError ? (
          <EmptyState title={loadError} action={<Button onClick={() => void load()}>Retry</Button>} />
        ) : products.length === 0 ? (
          <EmptyState
            title={catId || debouncedQ ? "No products match. Try another search →" : "No products yet. Add one in Products →"}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((p) => {
              const low = p.stock <= p.lowStockThreshold;
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (out) {
                      push("error", `${p.name} is out of stock`);
                      return;
                    }
                    add(p);
                  }}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-gray-300 active:scale-[0.98]"
                >
                  <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400">{p.sku}</p>
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
        )}
      </div>

      {/* Right cart — 380px */}
      <div className="flex w-[380px] shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <div className="flex gap-2">
            <select
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
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              onBlur={applyDiscount}
              placeholder="$ disc"
              className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm tabular-nums"
              aria-label="Discount"
            />
          </div>
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
                        const n = Number(e.target.value);
                        setQty(l.product.id, Number.isFinite(n) ? n : 0);
                      }}
                      className="h-7 w-10 rounded-md border border-gray-300 text-center text-sm tabular-nums"
                      aria-label={`${l.product.name} quantity`}
                    />
                    <button onClick={() => inc(l.product.id)} className="flex size-7 items-center justify-center rounded-md border border-gray-300 text-sm hover:bg-gray-50" aria-label={`Increase ${l.product.name}`}>+</button>
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
              <div className="flex justify-between text-gray-600"><dt>Discount</dt><dd>−{formatCents(totals.discountCents)}</dd></div>
            ) : null}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
              <dt className="text-gray-900">Total</dt>
              <dd className="text-emerald-800">{formatCents(totals.totalCents)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={clear} disabled={lines.length === 0}>Clear</Button>
            <Button variant="primary" size="lg" full onClick={() => setPayOpen(true)} disabled={lines.length === 0}>
              Charge {formatCents(totals.totalCents)} · F8
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">{count} items · idempotent checkout</p>
        </div>
      </div>

      {/* Payment sheet */}
      {payOpen ? (
        <Modal title={`Charge ${formatCents(totals.totalCents)}`} onClose={() => setPayOpen(false)}>
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Payment method">
            {(["CASH", "CARD", "QR"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${method === m ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {m}
              </button>
            ))}
          </div>

          {method === "CASH" ? (
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
          ) : (
            <Input label={`${method} reference`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "CARD" ? "Auth code / last 4" : "QR ref"} autoFocus />
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" full onClick={() => setPayOpen(false)}>Cancel · Esc</Button>
            <Button variant="primary" size="lg" full onClick={() => void doCharge()} disabled={!canCharge || charging}>
              {charging ? "Charging…" : method === "CASH" && tenderedCents < totals.totalCents ? "Enter tendered" : `Confirm ${formatCents(totals.totalCents)}`}
            </Button>
          </div>
        </Modal>
      ) : null}

      {receipt ? (
        <Modal title="Payment complete" onClose={() => setReceipt(null)}>
          <div className="text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-800">✓</span>
            <p className="font-mono text-sm text-gray-500">{receipt.orderNumber}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{formatCents(receipt.totalCents)}</p>
            <p className="mt-1 text-sm text-gray-600">Change due: <span className="font-semibold tabular-nums text-emerald-800">{formatCents(receipt.changeCents)}</span></p>
            <div className="mt-4">
              <Button variant="primary" full onClick={() => setReceipt(null)}>New sale · Enter</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
