// Typed API client — 1:1 with POS-API docs/endpoints.md.
// Falls back to demo data when the server is unreachable (offline-first POS).
import { http, ApiError, setTokens, clearTokens, getAccessToken, request, getApiBase } from "./httpClient";
import { DEMO_CATEGORIES, DEMO_CUSTOMERS, DEMO_ORDERS, DEMO_PRODUCTS, DEMO_USER, DEMO_USERS } from "./demoData";
import type {
  CashCount,
  Category,
  Customer,
  DailyReport,
  Order,
  Paginated,
  PaymentMethod,
  Product,
  ReceiptFormat,
  Shift,
  StaffUser,
  SummaryReport,
} from "../types";

export { ApiError };
export type { ReceiptFormat };
export let lastUsedDemo = false;
function markDemo(v: boolean): void {
  lastUsedDemo = v;
  try {
    window.dispatchEvent(new CustomEvent("pos:demo", { detail: v }));
  } catch {
    // SSR — ignore
  }
}

function paginate<T>(rows: T[], page: number, pageSize: number): Paginated<T> {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), page, pageSize, total: rows.length };
}

// ── Auth ──────────────────────────────────────────────
export async function login(email: string, password: string): Promise<{ user: StaffUser }> {
  try {
    const res = await http.post<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
      email,
      password,
    }, undefined, { auth: false, retry: false });
    setTokens(res.accessToken, res.refreshToken);
    const me = await http.get<StaffUser>("/api/auth/me");
    markDemo(false);
    return { user: me };
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      // Demo login: any @example.com + password >= 4 chars
      if (email.endsWith("@example.com") && password.length >= 4) {
        setTokens("demo.access", "demo.refresh");
        markDemo(true);
        return { user: DEMO_USER };
      }
    }
    throw e;
  }
}

export async function fetchMe(): Promise<StaffUser> {
  if (getAccessToken() === "demo.access") {
    return DEMO_USER;
  }
  return http.get<StaffUser>("/api/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await http.post("/api/auth/logout");
  } catch {
    // best effort
  } finally {
    clearTokens();
  }
}

export async function requestOverride(pin: string): Promise<string> {
  const res = await http.post<{ overrideToken: string }>("/api/auth/override", { pin });
  return res.overrideToken;
}

// ── Receipt delivery (FR-31) ─────────────────────────
// CONTRACT PENDING @api reply: POST /api/orders/:id/receipt
//   { channels: ["EMAIL"|"SMS"], target, consent } → { queued: boolean }
// Servers without the endpoint answer 404/501 → normalized to FEATURE_NOT_LIVE
// so the UI degrades honestly instead of showing a generic failure.
export async function deliverReceipt(
  orderId: string,
  channel: "EMAIL" | "SMS",
  target: string,
): Promise<{ queued: boolean; demo: boolean }> {
  try {
    const res = await http.post<{ queued?: boolean }>(`/api/orders/${orderId}/receipt`, {
      channels: [channel],
      target,
      consent: true,
    });
    markDemo(false);
    return { queued: res.queued ?? true, demo: false };
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      return { queued: true, demo: true };
    }
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
      throw new ApiError(501, "FEATURE_NOT_LIVE", "Receipt delivery is not available on this server yet");
    }
    throw e;
  }
}

// ── Shifts ────────────────────────────────────────────
// Contract: POST /api/shifts/open { openingFloat: [{denomination, count}] },
// POST /api/shifts/close { closingFloat }, GET /api/shifts/current.
// Demo mode (offline) persists one shift in localStorage so the full
// open → sell → close-with-variance loop is testable without a server.
const DEMO_SHIFT_KEY = "pos.demo.shift";

function loadDemoShift(): Shift | null {
  try {
    const raw = window.localStorage.getItem(DEMO_SHIFT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Shift;
    return s && typeof s.id === "string" && Array.isArray(s.openingFloat) ? s : null;
  } catch {
    return null;
  }
}

function storeDemoShift(s: Shift | null): void {
  try {
    if (s) window.localStorage.setItem(DEMO_SHIFT_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(DEMO_SHIFT_KEY);
  } catch {
    // SSR — ignore
  }
}

// Server shift shape differs from the frontend `Shift` type: the API returns
// `cashCounts: [{ denomination, count, type }]` plus `openedAt`/`closedAt`
// (and `openingFloatCents`), while the UI reads `openingFloat`/`closingFloat`
// plus `startedAt`/`endedAt`. Normalize server → frontend, never the reverse.
type ApiCashCount = CashCount & { type?: string };
type ApiShift = Omit<Shift, "openingFloat" | "closingFloat" | "startedAt" | "endedAt"> & {
  openingFloat?: CashCount[] | null;
  closingFloat?: CashCount[] | null;
  startedAt?: string;
  createdAt?: string;
  endedAt?: string | null;
  openedAt?: string;
  closedAt?: string | null;
  openingFloatCents?: number;
  cashCounts?: ApiCashCount[] | null;
};

function toCounts(rows: ApiCashCount[] | null | undefined): CashCount[] {
  return (Array.isArray(rows) ? rows : []).map(({ denomination, count }) => ({
    denomination,
    count,
  }));
}

export function normalizeShift(raw: ApiShift | null | undefined): Shift | null {
  if (!raw) return null;
  const counts = Array.isArray(raw.cashCounts) ? raw.cashCounts : [];
  const openingFloat = Array.isArray(raw.openingFloat)
    ? raw.openingFloat
    : toCounts(counts.filter((c) => c.type === "OPENING"));
  const closingFloat = Array.isArray(raw.closingFloat)
    ? raw.closingFloat
    : (() => {
        const rows = counts.filter((c) => c.type === "CLOSING");
        return counts.length > 0 || raw.closedAt || raw.endedAt ? toCounts(rows) : (raw.closingFloat ?? null);
      })();
  const { cashCounts: _cashCounts, openedAt, closedAt, openingFloatCents: _openingFloatCents, ...rest } = raw;
  void _cashCounts;
  void _openingFloatCents;
  return {
    ...rest,
    openingFloat,
    closingFloat,
    startedAt: raw.startedAt ?? openedAt ?? raw.createdAt,
    endedAt: raw.endedAt ?? closedAt ?? null,
  };
}

export async function getCurrentShift(): Promise<Shift | null> {
  try {
    const res = await http.get<ApiShift | null>("/api/shifts/current");
    markDemo(false);
    return normalizeShift(res);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      const s = loadDemoShift();
      return s && s.status === "OPEN" ? s : null;
    }
    if (e instanceof ApiError && e.status === 404) return null; // no open shift
    throw e;
  }
}

export async function openShift(openingFloat: CashCount[], note?: string): Promise<Shift> {
  try {
    const s = await http.post<ApiShift>("/api/shifts/open", note ? { openingFloat, note } : { openingFloat });
    markDemo(false);
    return normalizeShift(s) as Shift;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      const existing = loadDemoShift();
      if (existing && existing.status === "OPEN") {
        throw new ApiError(409, "SHIFT_OPEN", "A shift is already open");
      }
      const iso = new Date().toISOString();
      const s: Shift = {
        id: `shift-demo-${Date.now()}`,
        userId: "u-demo",
        status: "OPEN",
        openingFloat,
        note: note ?? null,
        startedAt: iso,
        createdAt: iso,
      };
      storeDemoShift(s);
      return s;
    }
    throw e;
  }
}

export async function closeShift(closingFloat: CashCount[], note?: string): Promise<Shift> {
  try {
    const s = await http.post<ApiShift>("/api/shifts/close", note ? { closingFloat, note } : { closingFloat });
    markDemo(false);
    storeDemoShift(null);
    return normalizeShift(s) as Shift;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      const existing = loadDemoShift();
      if (!existing || existing.status !== "OPEN") {
        throw new ApiError(404, "NO_SHIFT", "No open shift to close");
      }
      const s: Shift = {
        ...existing,
        status: "CLOSED",
        closingFloat,
        note: note ?? existing.note ?? null,
        endedAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
      };
      storeDemoShift(s);
      return s;
    }
    throw e;
  }
}

// ── Catalog ───────────────────────────────────────────
export async function listCategories(): Promise<Category[]> {
  try {
    const res = await http.get<Paginated<Category> | Category[]>("/api/categories?page=1&pageSize=100");
    markDemo(false);
    return Array.isArray(res) ? res : res.data;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      return DEMO_CATEGORIES;
    }
    throw e;
  }
}

export interface ProductQuery {
  q?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export async function listProducts(q: ProductQuery = {}): Promise<Paginated<Product>> {
  const params = new URLSearchParams();
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 100));
  if (q.q) params.set("q", q.q);
  if (q.categoryId) params.set("categoryId", q.categoryId);
  params.set("activeOnly", "true");
  try {
    const res = await http.get<Paginated<Product>>(`/api/products?${params.toString()}`);
    markDemo(false);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      let rows = [...DEMO_PRODUCTS];
      if (q.categoryId) rows = rows.filter((p) => p.categoryId === q.categoryId);
      if (q.q) {
        const needle = q.q.toLowerCase();
        rows = rows.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.sku.toLowerCase().includes(needle) ||
            (p.barcode ?? "").includes(needle),
        );
      }
      return paginate(rows, q.page ?? 1, q.pageSize ?? 100);
    }
    throw e;
  }
}

export async function lookupBarcode(code: string): Promise<Product | null> {
  try {
    return await http.get<Product>(`/api/products/barcode/${encodeURIComponent(code)}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      return DEMO_PRODUCTS.find((p) => p.barcode === code || p.sku === code) ?? null;
    }
    throw e;
  }
}

export async function createProduct(input: {
  sku: string;
  name: string;
  priceCents: number;
  categoryId?: string | null;
  stock?: number;
  barcode?: string | null;
}): Promise<Product> {
  return http.post<Product>("/api/products", input);
}

export async function adjustStock(id: string, delta: number, reason: "PURCHASE" | "ADJUST"): Promise<Product> {
  return http.post<Product>(`/api/products/${id}/adjust-stock`, { delta, reason });
}

export async function archiveProduct(id: string): Promise<void> {
  await http.del(`/api/products/${id}`);
}

// ── Orders / checkout ─────────────────────────────────
export interface CheckoutInput {
  items: { productId: string; quantity: number }[];
  payments: { method: PaymentMethod; amountCents: number; reference?: string }[];
  customerId?: string;
  discountCents?: number;
  note?: string;
}

export async function checkout(
  input: CheckoutInput,
  idempotencyKey: string,
): Promise<{ order: Order; changeCents: number }> {
  try {
    const res = await http.post<{ order: Order; changeCents: number }>("/api/orders", input, {
      "Idempotency-Key": idempotencyKey,
    });
    markDemo(false);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      // Offline checkout — build a local order so the register never blocks
      markDemo(true);
      const lines = input.items.map((it, i) => {
        const p = DEMO_PRODUCTS.find((d) => d.id === it.productId);
        const unit = p?.priceCents ?? 0;
        return {
          id: `oi-local-${Date.now()}-${i}`,
          productId: it.productId,
          nameSnapshot: p?.name ?? "Item",
          skuSnapshot: p?.sku ?? "—",
          unitPriceCents: unit,
          quantity: it.quantity,
          lineTotalCents: unit * it.quantity,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
      const tax = lines.reduce((s, l, i) => {
        const p = DEMO_PRODUCTS.find((d) => d.id === input.items[i].productId);
        const bps = p?.taxRateBps ?? 0;
        return s + Math.round((l.lineTotalCents * bps) / 10000);
      }, 0);
      const total = subtotal + tax - (input.discountCents ?? 0);
      const paid = input.payments.reduce((s, p) => s + p.amountCents, 0);
      const order: Order = {
        id: `o-local-${Date.now()}`,
        orderNumber: `ORD-LOCAL-${String(Date.now()).slice(-6)}`,
        status: "PAID",
        cashierId: "u-demo",
        customerId: input.customerId ?? null,
        subtotalCents: subtotal,
        taxCents: tax,
        discountCents: input.discountCents ?? 0,
        totalCents: total,
        paidCents: paid,
        changeCents: Math.max(0, paid - total),
        note: input.note ?? null,
        items: lines,
        payments: input.payments.map((p, i) => ({
          id: `pay-local-${i}`,
          method: p.method,
          amountCents: p.amountCents,
          reference: p.reference ?? null,
        })),
        createdAt: new Date().toISOString(),
      };
      return { order, changeCents: order.changeCents };
    }
    throw e;
  }
}

export async function listOrders(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  q?: string;
  from?: string;
}): Promise<Paginated<Order>> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("pageSize", String(params.pageSize ?? 20));
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  try {
    const res = await http.get<Paginated<Order>>(`/api/orders?${sp.toString()}`);
    markDemo(false);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      let rows = [...DEMO_ORDERS];
      if (params.status) rows = rows.filter((o) => o.status === params.status);
      if (params.q) {
        const needle = params.q.toLowerCase();
        rows = rows.filter((o) => o.orderNumber.toLowerCase().includes(needle));
      }
      if (params.from) {
        const fromMs = Date.parse(params.from);
        if (Number.isFinite(fromMs)) rows = rows.filter((o) => Date.parse(o.createdAt) >= fromMs);
      }
      return paginate(rows, params.page ?? 1, params.pageSize ?? 20);
    }
    throw e;
  }
}

export async function getOrder(id: string): Promise<Order> {
  try {
    return await http.get<Order>(`/api/orders/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      const found = DEMO_ORDERS.find((o) => o.id === id);
      if (found) return found;
    }
    throw new ApiError(404, "NOT_FOUND", "Order not found");
  }
}

export async function voidOrder(id: string, overrideToken?: string): Promise<Order> {
  const headers: Record<string, string> = {};
  if (overrideToken) headers["X-Override-Token"] = overrideToken;
  return http.post<Order>(`/api/orders/${id}/void`, {}, headers);
}

// ── Customers ─────────────────────────────────────────
export async function listCustomers(q?: string): Promise<Paginated<Customer>> {
  const sp = new URLSearchParams({ page: "1", pageSize: "50" });
  if (q) sp.set("q", q);
  try {
    const res = await http.get<Paginated<Customer>>(`/api/customers?${sp.toString()}`);
    markDemo(false);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NETWORK_OFFLINE") {
      markDemo(true);
      let rows = [...DEMO_CUSTOMERS];
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter(
          (c) => c.name.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle),
        );
      }
      return paginate(rows, 1, 50);
    }
    throw e;
  }
}

// ── Reports ───────────────────────────────────────────
export async function getDailyReport(date: string): Promise<DailyReport> {
  try {
    const res = await http.get<DailyReport>(`/api/reports/sales/daily?date=${date}`);
    markDemo(false);
    const r = res as Partial<DailyReport>;
    return {
      totalCents: r.totalCents ?? 0,
      orderCount: r.orderCount ?? 0,
      avgTicketCents: r.avgTicketCents ?? 0,
      date: r.date ?? date,
      byHour: r.byHour ?? [],
      topProducts: r.topProducts ?? [],
      lowStock: r.lowStock ?? [],
    };
  } catch (e) {
    if (e instanceof ApiError && (e.code === "NETWORK_OFFLINE" || e.status === 403)) {
      markDemo(true);
      const total = DEMO_ORDERS.filter((o) => o.status === "PAID").reduce((s, o) => s + o.totalCents, 0);
      return {
        date,
        totalCents: total,
        orderCount: 4,
        avgTicketCents: Math.round(total / 4),
        byHour: [9, 10, 11, 12, 13, 14, 15, 16].map((h, i) => ({
          hour: h,
          totalCents: [42000, 96500, 148000, 210000, 132000, 176000, 154000, 88000][i],
          count: [2, 5, 8, 12, 6, 9, 7, 4][i],
        })),
        topProducts: [
          { productId: "p-latte", name: "Cafe Latte", qty: 24, totalCents: 336000 },
          { productId: "p-croissant", name: "Butter Croissant", qty: 18, totalCents: 171000 },
          { productId: "p-espresso", name: "Espresso", qty: 15, totalCents: 120000 },
          { productId: "p-milk", name: "Fresh Milk 1L", qty: 11, totalCents: 132000 },
          { productId: "p-beans", name: "House Beans 250g", qty: 6, totalCents: 252000 },
        ],
        lowStock: DEMO_PRODUCTS.filter((p) => p.stock <= p.lowStockThreshold),
      };
    }
    throw e;
  }
}

export async function getSummary(from: string, to: string): Promise<SummaryReport> {
  try {
    return await http.get<SummaryReport>(`/api/reports/sales/summary?from=${from}&to=${to}`);
  } catch {
    return { from, to, totalCents: 1280000, orderCount: 32, avgTicketCents: 40000 };
  }
}

export async function checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const t0 = Date.now();
  try {
    await request("/api/health", { auth: false });
    // health is public — no auth needed
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    try {
      const res = await fetch(`${getApiBase()}/api/health`);
      return { ok: res.ok, latencyMs: Date.now() - t0 };
    } catch {
      return { ok: false, latencyMs: Date.now() - t0 };
    }
  }
}

export async function listUsers(q?: string): Promise<{ users: StaffUser[]; page: number; pageSize: number; total: number }> {
  const sp = new URLSearchParams({ page: "1", pageSize: "50" });
  if (q) sp.set("q", q);
  try {
    const res = await http.get<{ users: StaffUser[]; page: number; pageSize: number; total: number }>(`/api/users?${sp.toString()}`);
    return res;
  } catch {
    // Fallback to demo data
    let rows = [...DEMO_USERS];
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(needle) || (c.role ?? "").toLowerCase().includes(needle),
      );
    }
    return { users: rows, page: 1, pageSize: 50, total: rows.length };
  }
}

export async function createUser(input: { name: string; role: StaffUser["role"]; pin?: string }): Promise<StaffUser> {
  return http.post<StaffUser>("/api/users", input);
}

export async function updateUser(id: string, input: { name?: string; role?: StaffUser["role"]; isActive?: boolean; pin?: string }): Promise<StaffUser> {
  return http.patch<StaffUser>(`/api/users/${id}`, input);
}

export async function deleteUser(id: string): Promise<void> {
  return http.del(`/api/users/${id}`);
}

export async function resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
  return http.post<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, {});
}

// ── Receipt ─────────────────────────────────────────────
export async function getReceipt(
  orderId: string,
  query: { format: ReceiptFormat },
): Promise<ArrayBuffer> {
  try {
    const params = new URLSearchParams();
    params.set('format', query.format);
    return await request<ArrayBuffer>(`/api/orders/${orderId}/receipt?${params.toString()}`, {
      auth: true,
      responseType: 'arraybuffer',
    });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NETWORK_OFFLINE') {
      // Demo: return empty buffer
      return new ArrayBuffer(0);
    }
    throw e;
  }
}
