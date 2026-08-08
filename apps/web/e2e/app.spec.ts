import { test, expect } from '@playwright/test';

test.describe('MedCore HMS Playwright E2E Smoke Workflows', () => {
  test('1. Single Sign-On portal page & authentication accessibility', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/.*login/);
  });

  test('2. Clinical dashboard session rendering', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token-2026');
      localStorage.setItem('medcore-auth-storage', JSON.stringify({
        state: {
          currentUser: { id: 'sa-1', email: 'superadmin@medcore.org', role: 'SUPER_ADMIN', firstName: 'Super', lastName: 'Admin', isVerified: true },
          accessToken: 'mock-jwt-token-2026'
        },
        version: 0
      }));
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('3. Authenticated session navigation across core clinical routes', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token-2026');
      localStorage.setItem('medcore-auth-storage', JSON.stringify({
        state: {
          currentUser: { id: 'sa-1', email: 'superadmin@medcore.org', role: 'SUPER_ADMIN', firstName: 'Super', lastName: 'Admin', isVerified: true },
          accessToken: 'mock-jwt-token-2026'
        },
        version: 0
      }));
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto('/appointments');
    await expect(page).toHaveURL(/.*appointments/);

    await page.goto('/doctor-portal');
    await expect(page).toHaveURL(/.*doctor-portal/);

    await page.goto('/laboratory');
    await expect(page).toHaveURL(/.*laboratory/);

    await page.goto('/pharmacy');
    await expect(page).toHaveURL(/.*pharmacy/);

    await page.goto('/billing');
    await expect(page).toHaveURL(/.*billing/);
  });
});
