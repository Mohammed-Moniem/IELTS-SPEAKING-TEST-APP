import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

test.describe('Growth finalization surfaces', () => {
  test('admin ads route renders operations workspace', async ({ page }) => {
    await bootstrapSession(page, { adminRoles: ['superadmin'] });
    await mockAppConfig(page, { roles: ['superadmin'] });
    await mockUsageSummary(page);

    await page.route('**/api/v1/admin/ads/analytics', route =>
      route.fulfill(
        mockJsonSuccess({
          generatedAt: new Date().toISOString(),
          totals: {
            campaignCount: 2,
            advertiserCount: 1,
            impressions: 1200,
            clicks: 73,
            conversions: 7,
            ctrPercent: 6.08,
            estimatedMonthlyRevenueUsd: 499
          },
          byStatus: { active: 1, pending_review: 1 },
          byPlacement: { homepage_sponsor: 1, module_panel: 1 },
          topCampaigns: []
        })
      )
    );

    await page.route('**/api/v1/admin/ads/campaigns?**', route =>
      route.fulfill(
        mockJsonSuccess({
          items: [],
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false
        })
      )
    );

    await page.goto('/admin/ads');
    await expect(page.getByRole('heading', { name: /Advertising Operations/i })).toBeVisible();
  });

  test('progress page renders strength map and improvement plan cards', async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);

    await page.route('**/api/v1/app/progress-view?**', route =>
      route.fulfill(
        mockJsonSuccess({
          range: '30d',
          module: 'all',
          totals: {
            overallBand: 6.5,
            predictedScore: 7.0,
            testsCompleted: 5,
            studyHours: 8.2
          },
          trend: [
            { date: '2026-02-01', score: 6.1, target: 7 },
            { date: '2026-02-10', score: 6.4, target: 7 },
            { date: '2026-02-20', score: 6.6, target: 7 }
          ],
          skillBreakdown: {
            speaking: 6.4,
            writing: 6.3,
            reading: 6.8,
            listening: 6.7
          },
          attempts: []
        })
      )
    );

    await page.route('**/api/v1/app/insights/strength-map?**', route =>
      route.fulfill(
        mockJsonSuccess({
          generatedAt: new Date().toISOString(),
          range: '30d',
          from: '2026-01-29T00:00:00.000Z',
          to: '2026-02-28T00:00:00.000Z',
          dataSufficiency: 'medium',
          criteria: [
            {
              key: 'speaking_fluency',
              module: 'speaking',
              label: 'Fluency & Coherence',
              averageScore: 6.2,
              confidence: 'medium',
              dataPoints: 10,
              confidenceBand: { low: 5.6, high: 6.8 },
              trend: []
            }
          ],
          strongest: [],
          weakest: []
        })
      )
    );

    await page.route('**/api/v1/app/insights/improvement-plan?**', route =>
      route.fulfill(
        mockJsonSuccess({
          generatedAt: new Date().toISOString(),
          module: 'all',
          dataSufficiency: 'medium',
          predictionConfidence: 'medium',
          cards: [
            {
              criterionKey: 'speaking_fluency',
              module: 'speaking',
              title: 'Fluency & Coherence',
              currentBand: 6.2,
              targetBand: 7,
              deltaToTarget: 0.8,
              confidence: 0.62,
              dataPoints: 10,
              expectedBandImpact: 0.3,
              recommendedAction: 'Practice short timed speaking drills.',
              deepLink: '/app/speaking',
              supportingResources: []
            }
          ]
        })
      )
    );

    await page.goto('/app/progress');
    await expect(page.getByRole('heading', { name: /Strength Map/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Improvement Plan/i })).toBeVisible();
  });

  test('guide page renders GEO answer block', async ({ page }) => {
    await page.goto('/ielts/ielts-speaking-practice-online');
    await expect(page.getByRole('heading', { name: /Quick Answer/i })).toBeVisible();
    await expect(page.getByText(/When to use this strategy/i)).toBeVisible();
  });
});
