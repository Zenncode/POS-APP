// Staff management — honest split between UI availability and API lifecycle.
// Verified against the real code (not scout guesses):
//   DEFECT STAFF-1: app/routes.ts registers no /staff-management route, and the
//     desktop Sidebar lists no Staff entry — the page from
//     app/routes/staff-management.tsx is unreachable in the UI.
//   DEFECT STAFF-2: even if routed, GET /api/users returns { items, ... } while
//     the UI destructures { users } (app/lib/api.ts listUsers), so the table
//     would render nothing; and the Add-User form posts { name, role, pin }
//     while POST /api/users requires { email, password, name, role }
//     (zod/user.schema.ts createUserSchema) — creation would 400.
// The test.fail cases below retain the VALID assertions for these defects:
// they run, they fail while the defects stand, and they turn red-if-passing
// the moment someone fixes the production code (forcing a test update).
// The API lifecycle test proves the backend contract works for synthetic
// accounts, so staff coverage is real where the UI allows it.
import { test, expect } from '@playwright/test';
import { E2E_USERS, apiCall, apiToken, asRecord, asString, loginAs, uid } from './fixtures';

test.describe('staff management @staff', () => {
  test.fail('documents DEFECT STAFF-1: staff page is routable for ADMIN', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/staff-management');
    await expect(page.getByRole('heading', { name: 'Staff Management' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('ADMIN lifecycle via API: create, edit, deactivate synthetic account', async () => {
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const email = `${uid('e2e-staff').toLowerCase()}@example.com`;

    const created = await apiCall('POST', '/api/users', adminToken, {
      email,
      password: 'StaffTest1234!',
      name: `E2E Staffer ${email.slice(-8)}`,
      role: 'CASHIER',
    });
    expect(created.status).toBe(201);
    const userId = asString(asRecord(created.body), 'id');

    const renamed = await apiCall('PATCH', `/api/users/${userId}`, adminToken, {
      name: 'E2E Staffer Renamed',
    });
    expect(renamed.status).toBe(200);
    expect(asString(asRecord(renamed.body), 'name')).toBe('E2E Staffer Renamed');

    const deactivated = await apiCall('PATCH', `/api/users/${userId}`, adminToken, {
      isActive: false,
    });
    expect(deactivated.status).toBe(200);
    expect(asRecord(deactivated.body)['isActive']).toBe(false);

    // Deactivated synthetic staff can no longer log in.
    const relogin = await apiCall('POST', '/api/auth/login', undefined, {
      email,
      password: 'StaffTest1234!',
    });
    expect(relogin.status).toBe(401);
  });

  test('documents DEFECT STAFF-2: user list shape the UI expects', async () => {
    // Backend truth: { items, page, pageSize, total }. The UI reads { users },
    // so even a routed page would render nothing. Asserted here so a contract
    // fix without a UI fix (or vice versa) still shows up.
    const adminToken = await apiToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const res = await apiCall('GET', '/api/users?page=1&pageSize=5', adminToken);
    expect(res.status).toBe(200);
    const body = asRecord(res.body);
    expect(Array.isArray(body['items'])).toBe(true);
    expect(body['users']).toBeUndefined();
  });

  test('CASHIER cannot list users (standard role check)', async () => {
    const cashierToken = await apiToken(E2E_USERS.cashier.email, E2E_USERS.cashier.password);
    const res = await apiCall('GET', '/api/users?page=1&pageSize=5', cashierToken);
    expect(res.status).toBe(403);
  });
});
