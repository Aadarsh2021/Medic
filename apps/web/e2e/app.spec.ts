import { test, expect } from '@playwright/test';

test.describe('MedCore HMS Playwright E2E Smoke Workflows', () => {
  test('1. Redirects unauthenticated access to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
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
    await page.waitForSelector('input[type="email"]');

    // Click Super Admin Quick Login preset
    const superAdminPreset = page.locator('button', { hasText: 'Super Admin' }).first();
    await superAdminPreset.click();

    // Wait for redirect to /dashboard after authenticating
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard/);

    // Navigate using sidebar navigation items
    await page.locator('button', { hasText: 'Hospital Scheduling' }).click();
    await expect(page).toHaveURL(/.*appointments/);

    await page.locator('button', { hasText: 'Clinical Encounters' }).click();
    await expect(page).toHaveURL(/.*doctor-portal/);

    await page.locator('button', { hasText: 'Laboratory Diagnostics' }).click();
    await expect(page).toHaveURL(/.*laboratory/);

    await page.locator('button', { hasText: 'Pharmacy Inventory' }).click();
    await expect(page).toHaveURL(/.*pharmacy/);

    await page.locator('button', { hasText: 'Revenue & Billing' }).click();
    await expect(page).toHaveURL(/.*billing/);
  });
});
