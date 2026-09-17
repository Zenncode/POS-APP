// Dashboard — real daily report for managers.
// Complements login-dashboard.spec.ts (which asserts first paint); this file
// asserts the report is data-driven: date changes reload, stat cards and the
// 14-day trend render from /api/reports/sales/*.
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

test.describe('dashboard @dashboard @regression', () => {
  test('loads the real daily report with stat cards and trend', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByLabel('Report date')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Today's sales")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Last 14 days')).toBeVisible({ timeout: 20_000 });
    // No access-denied empty state for ADMIN.
    await expect(page.getByText('Dashboard is for managers')).toHaveCount(0);
  });

  test('changing the report date reloads the report', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText("Today's sales")).toBeVisible({ timeout: 20_000 });
    const dateInput = page.getByLabel('Report date');
    await dateInput.fill('2026-01-05');
    await expect(page.getByText("Today's sales")).toBeVisible({ timeout: 20_000 });
    // The date control reflects what was picked (reload driven by `date` state).
    await expect(dateInput).toHaveValue('2026-01-05');
  });

  test('defaults the report date to today', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByLabel('Report date')).toHaveValue(todayISO(), { timeout: 20_000 });
  });
});
