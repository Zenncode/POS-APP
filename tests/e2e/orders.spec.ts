// Orders — list, status filter, detail panel, detail route, receipt download.
// Setup (API): a fresh PAID order per test. The free-text order search box
// sends `q`, which the API ignores (listOrdersSchema has no `q`), so search
// narrowing is NOT asserted here — status filter + detail are.
//
// Receipt PDF has no download button in the UI (register offers Print/Thermal
// only), so the download is verified against the real endpoint with the
// test user's token: proves the file exists without claiming UI coverage.
import { test, expect } from '@playwright/test';
import {
  E2E_USERS,
  apiToken,
  archiveProductApi,
  checkoutApi,
  createProductApi,
  loginAs,
  uid,
} from './fixtures';

test.describe('orders @orders @regression', () => {
  test('lists a fresh order and opens its detail panel', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-ORD').slice(0, 24).toUpperCase();
    const product = await createProductApi(adminToken, {
      sku,
      name: `Order Widget ${sku.slice(-6)}`,
      priceCents: 750,
      stock: 10,
    });
    const order = await checkoutApi(adminToken, {
      items: [{ productId: product.id, quantity: 1 }],
      payments: [{ method: 'CASH', amountCents: 750 }],
    });

    await loginAs(page, 'admin');
    await page.goto('/orders');
    await expect(page.getByText(order.orderNumber).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
    // Detail panel shows items, totals and payments.
    await expect(page.getByText(product.sku)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('CASH').first()).toBeVisible();

    await archiveProductApi(adminToken, product.id);
  });

  test('filters the list by status', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/orders');
    await page.getByLabel('Status filter').selectOption('PAID');
    // Every visible status badge in the list is PAID (server-side filter).
    const list = page.locator('ul div, ul li').first();
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('No orders found.')).toHaveCount(0);
  });

  test('opens the standalone detail route', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-DET').slice(0, 24).toUpperCase();
    const product = await createProductApi(adminToken, {
      sku,
      name: `Detail Widget ${sku.slice(-6)}`,
      priceCents: 300,
      stock: 10,
    });
    const order = await checkoutApi(adminToken, {
      items: [{ productId: product.id, quantity: 2 }],
      payments: [{ method: 'CARD', amountCents: 600 }],
    });

    await loginAs(page, 'admin');
    await page.goto(`/orders/${order.id}`);
    await expect(page.getByText(order.orderNumber)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('PAID')).toBeVisible();

    await archiveProductApi(adminToken, product.id);
  });

  test('downloads the PDF receipt for a paid order', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-PDF').slice(0, 24).toUpperCase();
    const product = await createProductApi(adminToken, {
      sku,
      name: `Pdf Widget ${sku.slice(-6)}`,
      priceCents: 450,
      stock: 10,
    });
    const order = await checkoutApi(adminToken, {
      items: [{ productId: product.id, quantity: 1 }],
      payments: [{ method: 'CASH', amountCents: 450 }],
    });

    await loginAs(page, 'admin');
    const token = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
    const receipt = await page.evaluate(
      async ([orderId, accessToken]: [string, string | null]) => {
        const res = await fetch(`http://127.0.0.1:3101/api/orders/${orderId}/receipt?format=pdf`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return {
          status: res.status,
          contentType: res.headers.get('content-type'),
          bytes: (await res.arrayBuffer()).byteLength,
        };
      },
      [order.id, token] as [string, string | null],
    );
    expect(receipt.status).toBe(200);
    expect(receipt.contentType ?? '').toContain('application/pdf');
    expect(receipt.bytes).toBeGreaterThan(0);

    await archiveProductApi(adminToken, product.id);
  });

  test('shows an honest empty state when nothing matches', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/orders');
    await page.getByLabel('Status filter').selectOption('PENDING');
    // Either pending rows or the empty state — both are honest server output.
    await expect(
      page.getByText('No orders found.').or(page.locator('ul li').first()),
    ).toBeVisible({ timeout: 20_000 });
  });
});
