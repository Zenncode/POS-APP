// Authentication journeys — valid/invalid login, logout, auth guard.
// The happy-path login -> register -> dashboard journey stays in
// login-dashboard.spec.ts; this file covers the surrounding cases.
import { test, expect } from '@playwright/test';
import { E2E_USERS, loginAs } from './fixtures';

test.describe('authentication @auth @regression', () => {
  test('rejects a malformed email before calling the API', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('whatever123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rejects wrong credentials with a generic error (no leak)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(E2E_USERS.manager.email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword000!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // UI-safe generic message (login.tsx GENERIC_SIGNIN_ERROR) — never raw text.
    await expect(page.getByText('Sign in failed. Check your email and password.')).toBeVisible({
      timeout: 20_000,
    });
    const accessToken = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
    expect(accessToken).toBeFalsy();
  });

  test('requires a password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(E2E_USERS.manager.email);
    await page.getByLabel('Password', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your password.')).toBeVisible();
  });

  test('logout clears the session and returns to login', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    const accessToken = await page.evaluate(() => localStorage.getItem('pos.accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('pos.refreshToken'));
    expect(accessToken).toBeFalsy();
    expect(refreshToken).toBeFalsy();
  });

  test('unauthenticated deep link redirects to login', async ({ browser }) => {
    // Guard lives in AppShell -> RequireAuth (MainLayout.tsx:61-73), not in
    // register.tsx (which only shift-gates "Open a shift to start selling" and
    // navigates to /login on socket session-revoked). Documented behavior IS a
    // redirect to /login, so the strict assertion below stands. A fresh guest
    // context guarantees no leaked token: localStorage.clear() in a reused
    // context cannot clear in-memory auth state.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/register');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await ctx.close();
  });
});
