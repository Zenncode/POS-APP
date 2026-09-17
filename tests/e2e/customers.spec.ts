// Customers — search + detail through the real UI.
// Honest gap (documented, not skipped): customers.tsx is read-only — there is
// no create/edit UI (creation lives only at POST /api/customers, manager+).
// This spec asserts what the UI actually offers against the seeded customer.
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('customers @customers', () => {
  test('searches and opens the seeded customer with loyalty detail', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/customers');
    await page.getByLabel('Search customers').fill('E2E Walker');
    await expect(page.getByText('E2E Walker')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /E2E Walker/ }).click();
    await expect(page.getByRole('heading', { name: 'E2E Walker' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Loyalty points')).toBeVisible();
  });

  test('shows an honest empty state for no match', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/customers');
    await page.getByLabel('Search customers').fill('no-such-customer-zzz-999');
    await expect(page.getByText('No customers match.')).toBeVisible({ timeout: 20_000 });
  });

  test('prompts selection before showing detail', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/customers');
    await expect(page.getByText('Select a customer to see loyalty + recent orders.')).toBeVisible({
      timeout: 20_000,
    });
  });
});
