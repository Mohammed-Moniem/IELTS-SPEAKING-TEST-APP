import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

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
    await page.route('**/api/v1/app/dashboard-view**', route =>
      route.fulfill(
        mockJsonSuccess({
          generatedAt: new Date().toISOString(),
          plan: 'premium',
          kpis: {
            averageBand: 6.5,
            currentStreak: 4,
            testsCompleted: 12,
            nextGoalBand: 7
          },
          quickPractice: [],
          resume: null,
          recommended: [],
          activity: []
        })
      )
    );
    await page.route('**/api/v1/writing/history**', route => route.fulfill(mockJsonSuccess([])));

    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: /(welcome back|dashboard)/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Writing' })).toHaveCount(0);

    await page.goto('/app/writing');
    await expect(page.getByRole('heading', { name: 'Module not enabled' })).toBeVisible();
  });
});
