// Void + refund through the real UI as MANAGER (direct void, no PIN).
// Partial line-level refunds exist only at POST /api/orders/:id/refund with
// no UI control — documented here as an honest gap, not asserted.
import { test, expect } from '@playwright/test';
import {
  E2E_USERS,
  apiToken,
  archiveProductApi,
  checkoutApi,
  createProductApi,
  getOrderStatus,
  getProductStock,
  loginAs,
  uid,
} from './fixtures';

test.describe('void and refund @void @refund', () => {
  test('voids a paid order from the orders page and restores stock', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-VOID').slice(0, 24).toUpperCase();
    const name = `Void Widget ${sku.slice(-6)}`;
    const product = await createProductApi(adminToken, { sku, name, priceCents: 800, stock: 10 });
    const order = await checkoutApi(adminToken, {
      items: [{ productId: product.id, quantity: 2 }],
      payments: [{ method: 'CASH', amountCents: 1600 }],
    });
    expect(await getProductStock(adminToken, product.id)).toBe(8);

    await loginAs(page, 'manager');
    await page.goto('/orders');
    await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
    await page.getByRole('button', { name: /Void order/ }).click();
    await page.getByRole('button', { name: 'Void + restore stock' }).click();
    await expect(page.getByText(`${order.orderNumber} voided`)).toBeVisible({ timeout: 20_000 });

    // Persisted: order VOID and the 2 units restored.
    expect(await getOrderStatus(adminToken, order.id)).toBe('VOID');
    expect(await getProductStock(adminToken, product.id)).toBe(10);

    await archiveProductApi(adminToken, product.id);
  });

  test('refund page requires a reason, then voids + refunds the order', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-RFD').slice(0, 24).toUpperCase();
    const name = `Refund Widget ${sku.slice(-6)}`;
    const product = await createProductApi(adminToken, { sku, name, priceCents: 1100, stock: 10 });
    const order = await checkoutApi(adminToken, {
      items: [{ productId: product.id, quantity: 1 }],
      payments: [{ method: 'CARD', amountCents: 1100 }],
    });

    await loginAs(page, 'manager');
    await page.goto('/refund');
    await expect(page.getByRole('heading', { name: 'Refund' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
    await expect(page.getByText(`Order: ${order.orderNumber}`)).toBeVisible({ timeout: 20_000 });

    // Validation: native required blocks submit before any API call.
    const reasonInput = page.getByLabel(/Reason for refund/);
    await expect(reasonInput).toHaveAttribute('required', '');
    await page.getByRole('button', { name: /Void \+ refund/ }).click();
    expect(await reasonInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    expect(await reasonInput.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    await expect(page).toHaveURL(/\/refund/);
    expect(await getOrderStatus(adminToken, order.id)).toBe('PAID');
    expect(await getProductStock(adminToken, product.id)).toBe(9);

    await page.getByLabel(/Reason for refund/).fill('E2E defective item return');
    await page.getByRole('button', { name: /Void \+ refund/ }).click();
    await expect(page).toHaveURL(/\/orders/, { timeout: 20_000 });

    expect(await getOrderStatus(adminToken, order.id)).toBe('VOID');
    expect(await getProductStock(adminToken, product.id)).toBe(10);

    await archiveProductApi(adminToken, product.id);
  });

  test('cashiers are told voids need a manager PIN', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const cashierToken = await apiToken(E2E_USERS.cashier.email, E2E_USERS.cashier.password);
    const sku = uid('E2E-VPIN').slice(0, 24).toUpperCase();
    const product = await createProductApi(adminToken, { sku, name: `Pin Widget ${sku.slice(-6)}`, priceCents: 200, stock: 10 });
    // Cashiers only see their own orders (server-scoped), so the fixture
    // order is checked out as the cashier.
    const order = await checkoutApi(cashierToken, {
      items: [{ productId: product.id, quantity: 1 }],
      payments: [{ method: 'CASH', amountCents: 200 }],
    });

    await loginAs(page, 'cashier');
    await page.goto('/orders');
    await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
    // Role-appropriate guidance, no bypass: cashier flow demands manager approval.
    await expect(page.getByText('Cashier: needs manager PIN approval.')).toBeVisible({
      timeout: 20_000,
    });

    await archiveProductApi(adminToken, product.id);
  });
});
