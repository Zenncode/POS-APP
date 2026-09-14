// Central domain types — mirrors POS-API Prisma + Zod contracts.
// Money is ALWAYS integer cents. Format only at render via formatCents().

export type Role = "ADMIN" | "MANAGER" | "CASHIER";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  category?: Category | null;
  priceCents: number;
  costCents: number | null;
  taxRateBps: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export type OrderStatus = "PENDING" | "PAID" | "VOID" | "REFUNDED";
// WALLET is a CLIENT extension pending @api approval (REQUEST 2026-09-13,
// paymentInputSchema.method). The register only emits it in demo mode.
export type PaymentMethod = "CASH" | "CARD" | "QR" | "WALLET";

export interface OrderItem {
  id: string;
  productId: string;
  nameSnapshot: string;
  skuSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  reference: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  cashierId: string;
  cashier?: Pick<StaffUser, "id" | "name" | "email"> | null;
  customerId: string | null;
  customer?: Customer | null;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  changeCents: number;
  note: string | null;
  items: OrderItem[];
  payments: Payment[];
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  createdAt?: string;
  orders?: Order[];
}

export interface DailyReport {
  date: string;
  totalCents: number;
  orderCount: number;
  avgTicketCents: number;
  byHour: { hour: number; totalCents: number; count: number }[];
  topProducts: { productId: string; name: string; qty: number; totalCents: number }[];
  lowStock: Product[];
}

export interface SummaryReport {
  from: string;
  to: string;
  totalCents: number;
  orderCount: number;
  avgTicketCents: number;
}

// Shifts — mirrors POS-API /api/shifts contract (docs/endpoints.md §Shifts).
// Floats are per-denomination counts, values in cents.
export interface CashCount {
  denomination: number; // cents, positive int
  count: number; // int ≥ 0
}

export type ShiftStatus = "OPEN" | "CLOSED";

export interface Shift {
  id: string;
  userId: string;
  user?: Pick<StaffUser, "id" | "name" | "email"> | null;
  storeId?: string | null;
  status: ShiftStatus;
  openingFloat: CashCount[];
  closingFloat?: CashCount[] | null;
  note?: string | null;
  // Server naming may vary; both accepted, normalized client-side.
  startedAt?: string;
  createdAt?: string;
  endedAt?: string | null;
  closedAt?: string | null;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// Cart (client-only)
export interface CartLine {
  product: Product;
  qty: number;
}

export interface CartTotals {
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}
