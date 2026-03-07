import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

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
    await page.route('**/api/v1/app/progress-view**', route =>
      route.fulfill(mockJsonSuccess(learnerProgressView))
    );
    await page.route('**/api/v1/writing/history**', route => route.fulfill(mockJsonSuccess([])));

    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: /(welcome back|dashboard)/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Writing' })).toHaveCount(0);
    await expect(page.locator('aside').getByRole('link', { name: 'Books', exact: true })).toHaveCount(0);
    await expect(page.locator('aside').getByRole('link', { name: 'Channels', exact: true })).toHaveCount(0);

    await page.goto('/app/writing');
    await expect(page.getByRole('heading', { name: 'Module not enabled' })).toBeVisible();
  });

  test('blocks disabled learner library routes and hides their navigation', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
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
    await page.route('**/api/v1/app/progress-view**', route =>
      route.fulfill(mockJsonSuccess(learnerProgressView))
    );
    await page.route('**/api/v1/library/collocations?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 48,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.goto('/app/library/collocations');
    await expect(page.getByRole('heading', { name: /Collocations Library/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Books', exact: true })).toHaveCount(0);
    await expect(page.locator('aside').getByRole('link', { name: 'Channels', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Books', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Channels', exact: true })).toHaveCount(0);

    await page.goto('/app/library/books');
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    await page.goto('/app/library/channels');
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  });

  test('renders learner navigation as a mobile drawer on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootstrapSession(page);
    await mockAppConfig(page);
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
    await page.route('**/api/v1/app/progress-view**', route =>
      route.fulfill(mockJsonSuccess(learnerProgressView))
    );
    await page.route('**/api/v1/topics/practice**', route =>
      route.fulfill(
        mockJsonSuccess({
          topics: [
            {
              slug: 'local-food',
              title: 'Local Food',
              description: 'Describe a local dish you enjoy.',
              part: 1
            }
          ],
          total: 1,
          hasMore: false,
          limit: 9,
          offset: 0
        })
      )
    );
    await page.route('**/api/v1/practice/sessions?**', route => route.fulfill(mockJsonSuccess([])));
    await page.route('**/api/v1/test-simulations?**', route => route.fulfill(mockJsonSuccess([])));

    await page.goto('/app/dashboard');

    await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
    await expect(page.locator('aside').first()).toBeHidden();

    await page.getByRole('button', { name: /open navigation/i }).click();
    const mobileDialog = page.getByRole('dialog', { name: /learner navigation/i });
    await expect(mobileDialog).toBeVisible();
    await expect(mobileDialog.getByAltText('Spokio')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Speaking' })).toBeVisible();

    await page.getByRole('link', { name: 'Speaking' }).click();
    await expect(page).toHaveURL(/\/app\/speaking$/);
    await expect(page.getByRole('dialog', { name: /learner navigation/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Speaking Practice/i })).toBeVisible();
  });
});
