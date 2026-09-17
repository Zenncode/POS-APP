// Settings — connection check + local device controls.
// Verified against settings.tsx (not scout guesses):
//   DEFECT SETTINGS-1: store/receipt/device fields claim "Saved locally on
//     this device" but are plain useState with no localStorage persistence —
//     a reload resets them. The test.fail case retains the valid assertion.
// What IS tested honestly: the Test-connection control against the real API,
// and that the fields accept input (controls render + edit).
import { test, expect } from '@playwright/test';
import { loginAs, uid } from './fixtures';

test.describe('settings @settings', () => {
  test('test-connection reports the live API as reachable', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText(/API reachable/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible();
  });

  test('device fields accept input', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    const storeName = page.getByLabel('Store name');
    await expect(storeName).toBeVisible({ timeout: 20_000 });
    await storeName.fill('E2E Corner Shop');
    await expect(storeName).toHaveValue('E2E Corner Shop');
    await page.getByLabel('Receipt footer').fill('E2E thanks you');
    await expect(page.getByLabel('Receipt footer')).toHaveValue('E2E thanks you');
  });

  test.fail('documents DEFECT SETTINGS-1: store name persists across reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    const marker = `E2E Shop ${uid('p').slice(-6)}`;
    await page.getByLabel('Store name').fill(marker);
    await page.reload();
    await expect(page.getByLabel('Store name')).toHaveValue(marker, { timeout: 15_000 });
  });
});
