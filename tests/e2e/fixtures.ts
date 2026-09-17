// Shared E2E fixtures — real loopback API only, no mocks, no demo tokens.
// The Playwright webServer boots the isolated stack (API :3101, web :5193,
// postgres :55433, redis :56379); every helper below pins 127.0.0.1:3101 so a
// stray VITE_API_URL can never redirect a fixture at another backend.
//
// Contract: API calls are FIXTURE SETUP only (seed unique entities, open/close
// shifts, verify persistence). Every action under test is exercised through
// the UI. Tests are independent: each mints unique SKUs/phones/emails and
// closes shifts it opened. The shared MANAGER account is reserved for the
// legacy login-dashboard spec — new specs use ADMIN/CASHIER.
//
// Prerequisites (run once per session, from a shell):
//   1. cd POS-API && pnpm run e2e:infra:up
//   2. cd POS-API && pnpm run e2e:bootstrap   (guard + db push + seed; needs
//      DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/pos_e2e?schema=public
//      and NODE_ENV=test in the environment)
//   3. cd POS-APP && pnpm exec playwright test
// Run with a clean environment (no SMTP/TWILIO/VONAGE vars) — the Playwright
// config neutralizes messaging explicitly, but inherited secrets are never read.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Loopback-only API base. Never VITE_API_URL, never an env var.
export const E2E_API_BASE = 'http://127.0.0.1:3101';

// Seeded test accounts (seed-e2e.ts). Defaults match the seed; CI may
// override via E2E_* vars. Passwords are never logged.
export const E2E_USERS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin1234!',
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'e2e-manager@example.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'E2eManager1234!',
  },
  cashier: {
    email: process.env.E2E_CASHIER_EMAIL ?? 'e2e-cashier@example.com',
    password: process.env.E2E_CASHIER_PASSWORD ?? 'E2eCashier1234!',
  },
} as const;

export type RoleKey = keyof typeof E2E_USERS;

export function uid(prefix: string): string {
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

interface ApiResult {
  status: number;
  body: unknown;
}

export async function apiCall(
  method: string,
  path: string,
  token?: string,
  payload?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ApiResult> {
  const res = await fetch(`${E2E_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  throw new Error('E2E fixture: expected a JSON object from the API');
}

export function asString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`E2E fixture: expected string field "${key}"`);
  return value;
}

export function asNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') throw new Error(`E2E fixture: expected number field "${key}"`);
  return value;
}

export async function apiToken(email: string, password: string): Promise<string> {
  const res = await apiCall('POST', '/api/auth/login', undefined, { email, password });
  expect(res.status).toBe(200);
  return asString(asRecord(res.body), 'accessToken');
}

// UI login through the real form. Asserts the session is a backend JWT,
// never the offline demo placeholder.
export async function loginAs(page: Page, role: RoleKey): Promise<void> {
  const creds = E2E_USERS[role];
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/register/, { timeout: 20_000 });
  const accessToken = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
  expect(accessToken).toBeTruthy();
  expect(accessToken).not.toBe('demo.access');
  expect(accessToken ?? '').toContain('.');
}

// Shift fixture helpers (per-user isolation: closing/opening affects only the
// token owner's shift, so the shared MANAGER account stays untouched when
// specs use ADMIN/CASHIER).
export async function closeMyShift(token: string): Promise<void> {
  const current = await apiCall('GET', '/api/shifts/current', token);
  if (current.status === 200 && current.body !== null) {
    const closed = await apiCall('POST', '/api/shifts/close', token, {
      closingFloat: [{ denomination: 100, count: 1 }],
    });
    expect(closed.status).toBe(200);
  }
}

export async function openMyShift(token: string): Promise<void> {
  await closeMyShift(token);
  const opened = await apiCall('POST', '/api/shifts/open', token, {
    openingFloat: [{ denomination: 100, count: 50 }],
  });
  expect(opened.status).toBe(201);
}

export interface FixtureProduct {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

export async function createProductApi(
  adminToken: string,
  input: { sku: string; name: string; priceCents: number; stock: number; barcode?: string },
): Promise<FixtureProduct> {
  const res = await apiCall('POST', '/api/products', adminToken, {
    sku: input.sku,
    name: input.name,
    priceCents: input.priceCents,
    stock: input.stock,
    ...(input.barcode ? { barcode: input.barcode } : {}),
  });
  expect(res.status).toBe(201);
  const body = asRecord(res.body);
  return {
    id: asString(body, 'id'),
    sku: asString(body, 'sku'),
    name: asString(body, 'name'),
    priceCents: asNumber(body, 'priceCents'),
    stock: asNumber(body, 'stock'),
  };
}

export async function getProductStock(token: string, id: string): Promise<number> {
  const res = await apiCall('GET', `/api/products/${id}`, token);
  expect(res.status).toBe(200);
  return asNumber(asRecord(res.body), 'stock');
}

export async function archiveProductApi(adminToken: string, id: string): Promise<void> {
  const res = await apiCall('DELETE', `/api/products/${id}`, adminToken);
  expect(res.status).toBe(200);
}

export interface FixtureOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  status: string;
}

export async function checkoutApi(
  token: string,
  input: {
    items: { productId: string; quantity: number }[];
    payments: { method: string; amountCents: number }[];
  },
): Promise<FixtureOrder> {
  const res = await apiCall(
    'POST',
    '/api/orders',
    token,
    { items: input.items, payments: input.payments },
    { 'Idempotency-Key': uid('e2e-key') },
  );
  expect(res.status).toBe(201);
  const order = asRecord(asRecord(res.body)['order'] as unknown);
  return {
    id: asString(order, 'id'),
    orderNumber: asString(order, 'orderNumber'),
    totalCents: asNumber(order, 'totalCents'),
    status: asString(order, 'status'),
  };
}

export async function getOrderStatus(token: string, id: string): Promise<string> {
  const res = await apiCall('GET', `/api/orders/${id}`, token);
  expect(res.status).toBe(200);
  return asString(asRecord(res.body), 'status');
}
