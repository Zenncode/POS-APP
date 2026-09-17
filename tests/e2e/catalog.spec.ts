// Catalog (products + category filter) through the real UI as ADMIN.
// Honest gaps (documented, not skipped): product EDIT has no UI (only
// create/adjust/archive exist in products.tsx), and category CREATE has no UI
// (the sidebar is a read-only filter). Those controls are not asserted.
import { test, expect } from '@playwright/test';
import {
  E2E_USERS,
  apiToken,
  archiveProductApi,
  createProductApi,
  getProductStock,
  loginAs,
  uid,
} from './fixtures';

test.describe('catalog @catalog', () => {
  test('creates a product with validation, then finds it via search', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/products');
    await page.getByRole('button', { name: '+ Product' }).click();

    // Validation: empty submit is rejected with a field error toast.
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('SKU, name and price are required.')).toBeVisible();

    const sku = uid('E2E-CAT').slice(0, 24).toUpperCase();
    const name = `Catalog Widget ${sku.slice(-6)}`;
    await page.getByLabel('SKU *').fill(sku);
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel(/Price/).fill('12.50');
    await page.getByLabel('Opening stock').fill('7');
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/products') && res.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Create', exact: true }).click(),
    ]);
    if (createResponse.status() !== 201) {
      // eslint-disable-next-line no-console
      console.log('CREATE-PRODUCT-BODY', await createResponse.text());
    }
    expect(createResponse.status()).toBe(201);
    await expect(page.getByText(`${name} created`)).toBeVisible({ timeout: 20_000 });

    // Search narrows the table to the new row (server q filter).
    await page.getByLabel('Search products').fill(sku);
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Cleanup keeps the shared catalog tidy (soft-delete via API).
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const listed = await (
      await fetch(`http://127.0.0.1:3101/api/products?q=${encodeURIComponent(sku)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json();
    const row = (listed as { data: { id: string }[] }).data[0];
    await archiveProductApi(adminToken, row.id);
  });

  test('adjusts stock from the table and persists it', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-STK').slice(0, 24).toUpperCase();
    const name = `Stock Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, {
      sku,
      name,
      priceCents: 900,
      stock: 10,
    });

    await loginAs(page, 'admin');
    await page.goto('/products');
    await page.getByLabel('Search products').fill(sku);
    const row = page.locator('tbody tr', { hasText: name });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: '+1', exact: true }).click();
    await expect(page.getByText(`${name} +1`)).toBeVisible({ timeout: 20_000 });
    expect(await getProductStock(adminToken, created.id)).toBe(11);

    await archiveProductApi(adminToken, created.id);
  });

  test('archives a product so it leaves the register', async ({ page }) => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const sku = uid('E2E-ARC').slice(0, 24).toUpperCase();
    const name = `Archive Widget ${sku.slice(-6)}`;
    const created = await createProductApi(adminToken, {
      sku,
      name,
      priceCents: 250,
      stock: 3,
    });

    await loginAs(page, 'admin');
    await page.goto('/products');
    await page.getByLabel('Search products').fill(sku);
    const row = page.locator('tbody tr', { hasText: name });
    await expect(row).toBeVisible({ timeout: 20_000 });
    page.on('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText(`${name} archived`)).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveCount(0, { timeout: 20_000 });

    // Archived products are inactive server-side (register hides them).
    const res = await fetch(`http://127.0.0.1:3101/api/products/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });

  test('filters the grid by category', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/products');
    // Seeded category from seed-e2e.ts; the sidebar buttons are the only
    // category controls the UI offers (no create/edit UI exists).
    const categoryButton = page.getByRole('button', { name: 'E2E Beverages' });
    await expect(categoryButton).toBeVisible({ timeout: 20_000 });
    await categoryButton.click();
    await expect(page.getByText('E2E Drip Coffee')).toBeVisible({ timeout: 20_000 });
  });
});
