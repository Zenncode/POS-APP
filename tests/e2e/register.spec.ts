// Register — cart math plus CASH / CARD / SPLIT checkout through the real UI.
// Setup (API): unique product per test + an open CASHIER shift. Verification
// (API): order persisted in /api/orders and stock decremented. The receipt
// EMAIL/SMS buttons are intentionally NOT success-tested (SMTP/Twilio are
// fail-closed in the E2E env — see playwright.config.ts); only the receipt
// modal + persistence are asserted here.
import { test, expect } from '@playwright/test';
import {
  E2E_USERS,
  apiCall,
  apiToken,
  archiveProductApi,
  asNumber,
  asRecord,
  closeMyShift,
  createProductApi,
  getProductStock,
  loginAs,
  openMyShift,
  uid,
} from './fixtures';

async function listOrdersTotal(adminToken: string, orderId: string): Promise<number> {
  const res = await apiCall('GET', `/api/orders/${orderId}`, adminToken);
  if (res.status !== 200) throw new Error('E2E fixture: order not found after checkout');
  return asNumber(asRecord(res.body), 'totalCents');
}

test.describe('register @register @regression', () => {
  let adminToken = '';
  let cashierToken = '';

  test.beforeEach(async () => {
    adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    cashierToken = await apiToken(E2E_USERS.cashier.email, E2E_USERS.cashier.password);
    await openMyShift(cashierToken);
  });

  test.afterEach(async () => {
    await closeMyShift(cashierToken);
  });

  test('edits cart quantity and removes lines without checking out', async ({ page }) => {
    const sku = uid('E2E-CART').slice(0, 24).toUpperCase();
    const name = `Cart Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 450, stock: 20 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    await expect(page.getByTitle(`Add ${name} to cart`)).toBeVisible({ timeout: 20_000 });
    await page.getByTitle(`Add ${name} to cart`).click();

    const cart = page.getByRole('list', { name: 'Cart items' });
    await expect(cart.getByText(name)).toBeVisible();
    // Quantity stepper: + then - back, then remove.
    await cart.getByRole('button', { name: 'Increase' }).click();
    await expect(cart.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2');
    await cart.getByRole('button', { name: 'Decrease' }).click();
    await expect(cart.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1');
    await cart.getByRole('button', { name: `Remove ${name}` }).click();
    await expect(page.getByText('Cart empty')).toBeVisible();
    // Nothing was charged: stock untouched.
    expect(await getProductStock(adminToken, created.id)).toBe(20);

    await archiveProductApi(adminToken, created.id);
  });

  test('checks out CASH exact: receipt, persisted order, decremented stock', async ({ page }) => {
    const sku = uid('E2E-CASH').slice(0, 24).toUpperCase();
    const name = `Cash Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 450, stock: 20 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    await page.getByTitle(`Add ${name} to cart`).click();
    await page.getByRole('button', { name: /Charge/ }).click();

    // CASH tab is default: Exact tenders the full total, Confirm charges.
    await page.getByRole('button', { name: 'Exact' }).click();
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.getByText(/ORD-/).first()).toBeVisible({ timeout: 20_000 });

    // Persisted server-side with stock decremented by 1.
    expect(await getProductStock(adminToken, created.id)).toBe(19);
    const listed = await apiCall('GET', '/api/orders?page=1&pageSize=5', adminToken);
    expect(listed.status).toBe(200);
    const first = (asRecord(listed.body)['data'] as unknown[])[0];
    expect(asNumber(first as Record<string, unknown>, 'totalCents')).toBe(450);
    await expect(page.getByText(/ORD-/).first()).toBeVisible();

    await archiveProductApi(adminToken, created.id);
  });

  test('checks out CARD and persists the payment', async ({ page }) => {
    const sku = uid('E2E-CARD').slice(0, 24).toUpperCase();
    const name = `Card Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 600, stock: 20 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    await page.getByTitle(`Add ${name} to cart`).click();
    await page.getByRole('button', { name: /Charge/ }).click();

    await page.getByRole('tab', { name: 'CARD' }).click();
    await page.getByPlaceholder('Reference').fill(`e2e-ref-${sku.slice(-6)}`);
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.getByText(/ORD-/).first()).toBeVisible({ timeout: 20_000 });

    expect(await getProductStock(adminToken, created.id)).toBe(19);
    expect(await listOrdersTotal(adminToken, await newestOrderId(adminToken))).toBe(600);

    await archiveProductApi(adminToken, created.id);
  });

  test('checks out SPLIT across two tenders', async ({ page }) => {
    const sku = uid('E2E-SPLIT').slice(0, 24).toUpperCase();
    const name = `Split Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 1000, stock: 20 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    await page.getByTitle(`Add ${name} to cart`).click();
    await page.getByRole('button', { name: /Charge/ }).click();

    await page.getByRole('tab', { name: 'SPLIT' }).click();
    await page.getByLabel('Tender 1 amount').fill('4.00');
    await page.getByLabel('Tender 2 amount').fill('6.00');
    await expect(page.getByText('Covered')).toBeVisible();
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.getByText(/ORD-/).first()).toBeVisible({ timeout: 20_000 });

    expect(await getProductStock(adminToken, created.id)).toBe(19);

    await archiveProductApi(adminToken, created.id);
  });

  // External delivery must never happen from E2E: SMTP creds are blank and
  // SMS_PROVIDER=twilio has no creds (fail-closed 502), so even a valid
  // address ends in a failure toast — asserted here as the no-delivery proof.
  // Success-path EMAIL/SMS delivery is explicitly untested (needs a mailbox).
  test('receipt delivery validates input and fail-closes without SMTP', async ({ page }) => {
    const sku = uid('E2E-DLV').slice(0, 24).toUpperCase();
    const name = `Deliver Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 450, stock: 20 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    await page.getByTitle(`Add ${name} to cart`).click();
    await page.getByRole('button', { name: /Charge/ }).click();
    await page.getByRole('button', { name: 'Exact' }).click();
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect(page.getByText(/ORD-/).first()).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Receipt destination').fill('not-an-email');
    await page.getByRole('button', { name: 'Email receipt' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();

    await page.getByLabel('Receipt destination').fill('e2e-recipient@example.com');
    await page.getByRole('button', { name: 'Email receipt' }).click();
    await expect(page.getByText('Delivery failed. Try again.')).toBeVisible({ timeout: 20_000 });

    await archiveProductApi(adminToken, created.id);
  });

  test('disables charging with an empty cart', async ({ page }) => {    await loginAs(page, 'cashier');
    await page.goto('/register');
    await expect(page.getByText('Cart empty')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Charge/ })).toBeDisabled();
  });

  test('shows out-of-stock products as unavailable', async ({ page }) => {
    const sku = uid('E2E-OOS').slice(0, 24).toUpperCase();
    const name = `Empty Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, { sku, name, priceCents: 100, stock: 0 });

    await loginAs(page, 'cashier');
    await page.goto('/register');
    const tile = page.getByTitle(new RegExp(`${name}.*out of stock`));
    await expect(tile).toBeVisible({ timeout: 20_000 });
    await expect(tile).toBeDisabled();

    await archiveProductApi(adminToken, created.id);
  });
});

async function newestOrderId(adminToken: string): Promise<string> {
  const res = await apiCall('GET', '/api/orders?page=1&pageSize=1', adminToken);
  if (res.status !== 200) throw new Error('E2E fixture: could not list orders');
  const data = asRecord(res.body)['data'] as unknown[];
  const first = data[0] as Record<string, unknown>;
  const id = first['id'];
  if (typeof id !== 'string') throw new Error('E2E fixture: order id missing');
  return id;
}
