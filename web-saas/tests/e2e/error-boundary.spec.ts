import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const learnerDashboardView = {
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
};

const learnerProgressView = {
  range: '90d',
  module: 'all',
  totals: {
    overallBand: 6.2,
    predictedScore: 6.8,
    testsCompleted: 10,
    studyHours: 24
  },
  trend: [
    { date: '2026-01-01T00:00:00.000Z', score: 5.2, target: 6.5 },
    { date: '2026-01-10T00:00:00.000Z', score: 5.6, target: 6.5 }
  ],
  skillBreakdown: {
    speaking: 6.0,
    writing: 5.8,
    reading: 6.5,
    listening: 6.4
  },
  attempts: []
};

test.describe('Global error recovery', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);
    await page.route('**/api/v1/app/dashboard-view**', route =>
      route.fulfill(mockJsonSuccess(learnerDashboardView))
    );
    await page.route('**/api/v1/app/progress-view**', route =>
      route.fulfill(mockJsonSuccess(learnerProgressView))
    );
  });

  test('retry again performs a hard reload so a broken route can recover', async ({ page }) => {
    await page.goto('/app/error-probe');

    await expect(page.getByRole('heading', { name: 'Something Went Wrong' })).toBeVisible();

    await page.getByRole('button', { name: 'Try Again' }).click();

    await expect(page.getByRole('heading', { name: 'Reload recovery confirmed' })).toBeVisible();
  });

  test('go to dashboard exits the broken route', async ({ page }) => {
    await page.goto('/app/error-probe');

    await expect(page.getByRole('heading', { name: 'Something Went Wrong' })).toBeVisible();

    await page.getByText('Go to Dashboard', { exact: true }).click();

    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.getByRole('heading', { name: /(welcome back|dashboard)/i })).toBeVisible();
  });
});
