import { test, expect } from '@playwright/test';

test.describe('MedCore HMS Live Authentication & Token Propagation Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Real UI login attaches Authorization header and protected endpoints return 200 OK', async ({ page }) => {
    await page.waitForSelector('button:has-text("Super Admin")');

    // Set up response listener before clicking login
    const dashResponsePromise = page.waitForResponse((res) => res.url().includes('/analytics/dashboard'));

    // Perform REAL UI Quick Login
    await page.click('button:has-text("Super Admin")');

    // Wait for dashboard URL & response
    await expect(page).toHaveURL(/.*dashboard/);
    const dashRes = await dashResponsePromise;
    expect(dashRes.status()).toBe(200);

    // Verify Authorization header was sent on request
    const requestHeaders = dashRes.request().headers();
    expect(requestHeaders['authorization']).toContain('Bearer ');

    // Reload page to verify Zustand hydration & persistent token propagation
    const reloadDashPromise = page.waitForResponse((res) => res.url().includes('/analytics/dashboard'));
    await page.reload();
    await expect(page).toHaveURL(/.*dashboard/);

    const reloadedDashRes = await reloadDashPromise;
    expect(reloadedDashRes.status()).toBe(200);
    expect(reloadedDashRes.request().headers()['authorization']).toContain('Bearer ');
  });

  test('2. All 9 Quick Login roles authenticate and receive 200 OK on landing telemetry', async ({ page }) => {
    const roles = [
      'Super Admin',
      'Hospital Admin',
      'Doctor',
      'Nurse',
      'Receptionist',
      'Lab Tech',
      'Pharmacist',
      'Accountant',
      'Patient',
    ];

    for (const roleText of roles) {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      await page.waitForSelector(`button:has-text("${roleText}")`);

      const dashPromise = page.waitForResponse((res) => res.url().includes('/analytics/dashboard'));
      await page.click(`button:has-text("${roleText}")`);

      await expect(page).toHaveURL(/.*dashboard/);
      const dashRes = await dashPromise;
      expect(dashRes.status()).toBe(200);

      // Verify token exists in localStorage
      const token = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(token).toBeTruthy();
    }
  });
});
