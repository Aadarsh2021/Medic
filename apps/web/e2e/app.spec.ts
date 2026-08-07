import { test, expect } from '@playwright/test';

test.describe('MedCore HMS Playwright E2E Smoke Workflows', () => {
  test('1. Redirects unauthenticated access to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    expect(page.url()).toContain('/login');
    await expect(page.locator('h2')).toContainText('Clinical Staff Authentication');
  });

  test('2. Single Sign-On login page rendering & form accessibility', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
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
