import { test, expect } from '@playwright/test';

// Minimal real-browser journey: login -> register -> dashboard.
// Uses ONLY real backend responses — no route mocks, no demo tokens,
// no localStorage bypass. Fails if the API is unreachable (the app would
// fall back to demo mode, and the JWT assertion below catches that).
//
// Prerequisites (run once, from a shell — see report):
//   1. cd POS-API && pnpm run e2e:infra:up
//   2. cd POS-API && $env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55433/pos_e2e?schema=public'; $env:NODE_ENV='test'; pnpm run e2e:bootstrap   (db push + test-only seed, same URL + NODE_ENV=test the Playwright webServer sets inline)
//   3. cd POS-APP && pnpm exec playwright test (webServer boots test API+web)
// Test account is seeded by POS-API/scripts/e2e/seed-e2e.ts (MANAGER role,
// which is the minimum role the dashboard route allows).
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'e2e-manager@example.com';
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? 'E2eManager1234!';

test('login -> register -> dashboard shows the real report', async ({ page }) => {
  // 1. Login form renders with real labels (app/routes/login.tsx).
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  // 2. Sign in with the seeded MANAGER account.
  await page.getByLabel('Email', { exact: true }).fill(MANAGER_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(MANAGER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // 3. Authenticated users land on /register (login.tsx NEXT = "/register").
  await expect(page).toHaveURL(/\/register/, { timeout: 20_000 });

  // 4. Prove the session came from the REAL backend: a JWT access token,
  //    never the offline demo placeholder ("demo.access", see app/lib/api.ts).
  const accessToken = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
  expect(accessToken).toBeTruthy();
  expect(accessToken).not.toBe('demo.access');
  expect(accessToken ?? '').toContain('.');

  // 5. Fresh E2E DB has no open shift, so the register honestly gates selling
  //    (data-driven from GET /api/shifts/current — not a mock).
  await expect(page.getByText('Open a shift to start selling')).toBeVisible({ timeout: 20_000 });

  // 6. Dashboard renders the real report for a MANAGER (app/routes/dashboard.tsx):
  //    date picker + stat cards + trend section from /api/reports/sales/*.
  await page.goto('/dashboard');
  await expect(page.getByLabel('Report date')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Today's sales")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Last 14 days')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Dashboard is for managers')).toHaveCount(0);
});
