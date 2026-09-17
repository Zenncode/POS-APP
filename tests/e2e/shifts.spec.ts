// Shift open/close through the real UI (ADMIN account — the shared MANAGER
// account stays shift-free for the legacy login-dashboard spec).
// Precondition per test: closeMyShift via API (scoped to the ADMIN user only).
import { test, expect } from '@playwright/test';
import { E2E_USERS, apiCall, apiToken, closeMyShift, loginAs } from './fixtures';

test.describe('shifts @shifts', () => {
  test.beforeEach(async () => {
    await closeMyShift(await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password));
  });

  test.afterEach(async () => {
    await closeMyShift(await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password));
  });

  test('blocks opening with an empty float', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/shift');
    await expect(page.getByRole('heading', { name: 'Open shift' })).toBeVisible({ timeout: 20_000 });
    const openButton = page.getByRole('button', { name: 'Open shift & start selling' });
    await expect(openButton).toBeDisabled();
    await expect(page.getByText('Enter at least one denomination count.')).toBeVisible();
  });

  test('opens with a counted float then closes with zero variance', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/shift');
    await expect(page.getByRole('heading', { name: 'Open shift' })).toBeVisible({ timeout: 20_000 });

    // Count 5 of the first denomination, leave the rest at 0.
    await page.getByLabel(/Count of/).first().fill('5');
    const openButton = page.getByRole('button', { name: 'Open shift & start selling' });
    await expect(openButton).toBeEnabled();
    await openButton.click();
    await expect(page).toHaveURL(/\/register/, { timeout: 20_000 });

    // Selling is now ungated for this user.
    await expect(page.getByText('Open a shift to start selling')).toHaveCount(0);
    // Settle the post-open shift fetch before leaving /register (avoids a
    // race where /shift renders before the new shift is visible).
    await page
      .waitForResponse(
        (res) => res.url().includes('/api/shifts/current') && res.request().method() === 'GET',
        { timeout: 10_000 },
      )
      .catch(() => null);

    // Close with the identical count: expected == counted, variance 0, no note needed.
    const adminTokenForShiftPoll = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    await expect
      .poll(
        async () => (await apiCall('GET', '/api/shifts/current', adminTokenForShiftPoll)).status,
        { timeout: 15_000 },
      )
      .toBe(200);
    await page.goto('/shift', { waitUntil: 'networkidle' });
    await page
      .waitForResponse(
        (res) => res.url().includes('/api/shifts/current') && res.request().method() === 'GET',
        { timeout: 10_000 },
      )
      .catch(() => null);
    await expect(page.getByRole('heading', { name: 'Close shift' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Count of/).first().fill('5');
    const closeButton = page.getByRole('button', { name: 'Close shift & sign out' });
    await expect(closeButton).toBeEnabled();
    const closeResp = page.waitForResponse(
      (res) => res.url().includes('/api/shifts/close') && res.request().method() === 'POST',
      { timeout: 10_000 },
    ).catch(() => null);
    await closeButton.click();
    console.log('close status:', (await closeResp)?.status());
    // Closing ends the session (FR-04) — back at login with no tokens.
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    const accessToken = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
    expect(accessToken).toBeFalsy();
  });
});
