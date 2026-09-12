// Seeded demo catalog — used when the API is unreachable so the POS
// stays fully functional offline. Test data only, no real PII.
import type { Category, Customer, Order, Product, StaffUser } from "../types";

export const DEMO_CATEGORIES: Category[] = [
  { id: "cat-coffee", name: "Coffee", productCount: 4 },
  { id: "cat-pastry", name: "Pastry", productCount: 4 },
  { id: "cat-merch", name: "Merch", productCount: 3 },
  { id: "cat-grocery", name: "Grocery", productCount: 3 },
];

export const DEMO_PRODUCTS: Product[] = [
  { id: "p-espresso", sku: "CF-001", barcode: "100001", name: "Espresso", categoryId: "cat-coffee", priceCents: 250, costCents: 80, taxRateBps: 1000, stock: 48, lowStockThreshold: 5, isActive: true },
  { id: "p-latte", sku: "CF-002", barcode: "100002", name: "Cafe Latte", categoryId: "cat-coffee", priceCents: 420, costCents: 120, taxRateBps: 1000, stock: 36, lowStockThreshold: 5, isActive: true },
  { id: "p-cappuccino", sku: "CF-003", barcode: "100003", name: "Cappuccino", categoryId: "cat-coffee", priceCents: 450, costCents: 130, taxRateBps: 1000, stock: 4, lowStockThreshold: 5, isActive: true },
  { id: "p-coldbrew", sku: "CF-004", barcode: "100004", name: "Cold Brew", categoryId: "cat-coffee", priceCents: 500, costCents: 140, taxRateBps: 1000, stock: 22, lowStockThreshold: 5, isActive: true },
  { id: "p-croissant", sku: "PA-001", barcode: "200001", name: "Butter Croissant", categoryId: "cat-pastry", priceCents: 320, costCents: 110, taxRateBps: 1000, stock: 18, lowStockThreshold: 6, isActive: true },
  { id: "p-banana-bread", sku: "PA-002", barcode: "200002", name: "Banana Bread", categoryId: "cat-pastry", priceCents: 350, costCents: 120, taxRateBps: 1000, stock: 12, lowStockThreshold: 6, isActive: true },
  { id: "p-ensaymada", sku: "PA-003", barcode: "200003", name: "Ensaymada", categoryId: "cat-pastry", priceCents: 300, costCents: 100, taxRateBps: 1000, stock: 3, lowStockThreshold: 6, isActive: true },
  { id: "p-cheesecake", sku: "PA-004", barcode: "200004", name: "Cheesecake Slice", categoryId: "cat-pastry", priceCents: 550, costCents: 200, taxRateBps: 1000, stock: 9, lowStockThreshold: 4, isActive: true },
  { id: "p-mug", sku: "MC-001", barcode: "300001", name: "Store Mug", categoryId: "cat-merch", priceCents: 1200, costCents: 450, taxRateBps: 1000, stock: 15, lowStockThreshold: 3, isActive: true },
  { id: "p-tumbler", sku: "MC-002", barcode: "300002", name: "Tumbler 500ml", categoryId: "cat-merch", priceCents: 1800, costCents: 700, taxRateBps: 1000, stock: 7, lowStockThreshold: 3, isActive: true },
  { id: "p-beans", sku: "MC-003", barcode: "300003", name: "House Beans 250g", categoryId: "cat-merch", priceCents: 950, costCents: 380, taxRateBps: 0, stock: 20, lowStockThreshold: 5, isActive: true },
  { id: "p-rice", sku: "GR-001", barcode: "400001", name: "Rice 5kg", categoryId: "cat-grocery", priceCents: 3250, costCents: 2600, taxRateBps: 0, stock: 14, lowStockThreshold: 4, isActive: true },
  { id: "p-eggs", sku: "GR-002", barcode: "400002", name: "Eggs 12pcs", categoryId: "cat-grocery", priceCents: 890, costCents: 640, taxRateBps: 0, stock: 2, lowStockThreshold: 6, isActive: true },
  { id: "p-milk", sku: "GR-003", barcode: "400003", name: "Fresh Milk 1L", categoryId: "cat-grocery", priceCents: 460, costCents: 320, taxRateBps: 0, stock: 25, lowStockThreshold: 8, isActive: true },
];

export const DEMO_CUSTOMERS: Customer[] = [
  { id: "c-1", name: "Maria Santos", phone: "09171234567", email: "maria@example.com", loyaltyPoints: 120 },
  { id: "c-2", name: "Jose Rizal", phone: "09189876543", email: "jose@example.com", loyaltyPoints: 45 },
  { id: "c-3", name: "Ana Reyes", phone: "09155550123", email: null, loyaltyPoints: 0 },
];

function demoOrder(n: number, totalCents: number, status: Order["status"]): Order {
  return {
    id: `o-demo-${n}`,
    orderNumber: `ORD-2026091${n}-DEMO${n}`,
    status,
    cashierId: "u-demo",
    cashier: { id: "u-demo", name: "Demo Cashier", email: "cashier@example.com" },
    customerId: n % 2 === 0 ? "c-1" : null,
    customer: n % 2 === 0 ? DEMO_CUSTOMERS[0] : null,
    subtotalCents: totalCents,
    taxCents: Math.round(totalCents * 0.1),
    discountCents: 0,
    totalCents: totalCents + Math.round(totalCents * 0.1),
    paidCents: totalCents + Math.round(totalCents * 0.1),
    changeCents: 0,
    note: null,
    items: [
      {
        id: `oi-${n}-1`,
        productId: "p-latte",
        nameSnapshot: "Cafe Latte",
        skuSnapshot: "CF-002",
        unitPriceCents: 420,
        quantity: 2,
        lineTotalCents: 840,
      },
    ],
    payments: [{ id: `pay-${n}`, method: "CASH", amountCents: totalCents, reference: null }],
    createdAt: new Date(Date.now() - n * 36e5).toISOString(),
  };
}

export const DEMO_ORDERS: Order[] = [
  demoOrder(1, 840, "PAID"),
  demoOrder(2, 1250, "PAID"),
  demoOrder(3, 500, "VOID"),
  demoOrder(4, 2100, "PAID"),
  demoOrder(5, 670, "PAID"),
];

export const DEMO_USER = {
  id: "u-demo",
  email: "cashier@example.com",
  name: "Demo Cashier",
  role: "CASHIER" as const,
  storeId: "store-demo",
  isActive: true,
};

export const DEMO_USERS: StaffUser[] = [
  {
    ...DEMO_USER,
  },
  {
    id: "u-admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN" as const,
    storeId: "store-admin-1",
    isActive: true,
  },
  {
    id: "u-manager-1",
    email: "manager@example.com",
    name: "Manager User",
    role: "MANAGER" as const,
    storeId: "store-manager-1",
    isActive: true,
  },
  {
    id: "u-cashier-1",
    email: "cashier2@example.com",
    name: "Cashier User",
    role: "CASHIER" as const,
    storeId: "store-cashier-1",
    isActive: true,
  },
];