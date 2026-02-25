import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockUsageSummary } from './helpers/mockApi';

test.describe('Auth and feature gating', () => {
  test('requires login for protected learner routes', async ({ page }) => {
    await page.goto('/app/dashboard');

    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Login' })).toBeVisible();
  });

  test('enforces module flag gate when a feature is disabled', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page, {
      featureFlags: {
        writing_module: { enabled: false, rolloutPercentage: 0 }
      }
    });
    await mockUsageSummary(page);

    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Writing' })).toHaveCount(0);

    await page.goto('/app/writing');
    await expect(page.getByRole('heading', { name: 'Module not enabled' })).toBeVisible();
  });
});
