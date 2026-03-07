import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const sessionStorageKey = 'spokio.web.session.v1';

const mockJsonFailure = (status: number, message: string) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    status,
    success: false,
    message,
    timestamp: new Date().toISOString()
  })
});

const setupBillingBaseRoutes = async (page: Page) => {
  await page.route('**/api/v1/subscription/plans', route =>
    route.fulfill(
      mockJsonSuccess({
        plans: [
          {
            tier: 'free',
            name: 'Free',
            headline: 'Starter',
            description: 'Base package',
            audience: 'Learners',
            features: ['Starter'],
            pricing: {
              currency: 'USD',
              monthly: { amount: 0 }
            },
            limits: {
              practiceSessionsPerMonth: 3,
              simulationSessionsPerMonth: 1,
              writingSubmissionsPerMonth: 2,
              readingAttemptsPerMonth: 2,
              listeningAttemptsPerMonth: 2
            }
          },
          {
            tier: 'premium',
            name: 'Premium',
            headline: 'Focus',
            description: 'Practice limits',
            audience: 'Daily learners',
            features: ['Practice limits'],
            pricing: {
              currency: 'USD',
              monthly: { amount: 14, priceId: 'price_premium_monthly' },
              annual: { amount: 140, priceId: 'price_premium_annual', savingsPercent: 17 }
            },
            limits: {
              practiceSessionsPerMonth: -1,
              simulationSessionsPerMonth: -1,
              writingSubmissionsPerMonth: -1,
              readingAttemptsPerMonth: -1,
              listeningAttemptsPerMonth: -1
            }
          },
          {
            tier: 'pro',
            name: 'Pro',
            headline: 'Max quota',
            description: 'Highest individual package',
            audience: 'Advanced learners',
            recommended: true,
            features: ['Max quota'],
            pricing: {
              currency: 'USD',
              monthly: { amount: 29, priceId: 'price_pro_monthly' },
              annual: { amount: 290, priceId: 'price_pro_annual', savingsPercent: 17 }
            },
            limits: {
              practiceSessionsPerMonth: -1,
              simulationSessionsPerMonth: -1,
              writingSubmissionsPerMonth: -1,
              readingAttemptsPerMonth: -1,
              listeningAttemptsPerMonth: -1
            }
          }
        ]
      })
    )
  );

  await page.route('**/api/v1/subscription/current', route =>
    route.fulfill(
      mockJsonSuccess({
        planType: 'free',
        status: 'active'
      })
    )
  );

  await page.route('**/api/v1/subscription/config', route =>
    route.fulfill(
      mockJsonSuccess({
        enabled: true,
        mode: 'test',
        publishableKey: 'pk_test_123',
        portalEnabled: true,
        prices: {
          premium: 'price_premium_monthly',
          pro: 'price_pro_monthly',
          team: 'price_team_monthly'
        },
        priceMatrix: {
          premium: { monthly: 'price_premium_monthly', annual: 'price_premium_annual' },
          pro: { monthly: 'price_pro_monthly', annual: 'price_pro_annual' },
          team: { monthly: 'price_team_monthly', annual: 'price_team_annual' }
        }
      })
    )
  );
};

const setupLearnerContext = async (page: Page) => {
  await bootstrapSession(page);
  await mockAppConfig(page);
  await mockUsageSummary(page);
};

const gotoStable = async (page: Page, routePath: string) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientNavigationIssue =
        message.includes('NS_BINDING_ABORTED') || message.includes('interrupted by another navigation');
      if (!isTransientNavigationIssue || attempt === maxAttempts) {
        throw error;
      }
      await page.waitForTimeout(200);
    }
  }
};

test.describe('Billing and auth session runtime hardening', () => {
  test('aligns billing plan actions across cards with uneven content', async ({ page }) => {
    await setupLearnerContext(page);

    await page.route('**/api/v1/subscription/plans', route =>
      route.fulfill(
        mockJsonSuccess({
          plans: [
            {
              tier: 'premium',
              name: 'Premium',
              headline: 'Focused daily practice',
              description: 'Solid AI support for learners who want steady weekly progress.',
              audience: 'Daily learners',
              features: [
                'AI feedback across every IELTS module',
                'Structured daily practice without advanced analytics',
                'Core progress tracking for consistency'
              ],
              pricing: {
                currency: 'USD',
                monthly: { amount: 19, priceId: 'price_premium_monthly' }
              },
              limits: {
                practiceSessionsPerMonth: -1,
                simulationSessionsPerMonth: -1,
                writingSubmissionsPerMonth: -1,
                readingAttemptsPerMonth: -1,
                listeningAttemptsPerMonth: -1
              }
            },
            {
              tier: 'pro',
              name: 'Pro',
              headline: 'Advanced acceleration with personalized strategy',
              description:
                'Advanced analytics, priority AI scoring, custom study plans, and score prediction for exam sprints.',
              audience: 'Advanced learners',
              recommended: true,
              features: [
                'Everything in Premium with priority scoring throughput',
                'Advanced analytics and full mock readiness',
                'Custom study plans and score prediction',
                'Band Score Improvement Guarantee included'
              ],
              pricing: {
                currency: 'USD',
                monthly: { amount: 49, priceId: 'price_pro_monthly' }
              },
              limits: {
                practiceSessionsPerMonth: -1,
                simulationSessionsPerMonth: -1,
                writingSubmissionsPerMonth: -1,
                readingAttemptsPerMonth: -1,
                listeningAttemptsPerMonth: -1
              }
            },
            {
              tier: 'team',
              name: 'Team',
              headline: 'Small cohorts and coaching teams',
              description:
                'Coach dashboard and student management for mentor-led cohorts and institutions.',
              audience: 'Teams',
              features: [
                'Everything in Pro with shared throughput',
                'Coach dashboard and student management',
                'Group analytics and operational support'
              ],
              pricing: {
                currency: 'USD',
                monthly: { amount: 99, priceId: 'price_team_monthly' }
              },
              limits: {
                practiceSessionsPerMonth: -1,
                simulationSessionsPerMonth: -1,
                writingSubmissionsPerMonth: -1,
                readingAttemptsPerMonth: -1,
                listeningAttemptsPerMonth: -1
              }
            }
          ]
        })
      )
    );

    await page.route('**/api/v1/subscription/current', route =>
      route.fulfill(
        mockJsonSuccess({
          planType: 'free',
          status: 'active'
        })
      )
    );

    await page.route('**/api/v1/subscription/config', route =>
      route.fulfill(
        mockJsonSuccess({
          enabled: true,
          mode: 'test',
          publishableKey: 'pk_test_123',
          portalEnabled: true,
          prices: {
            premium: 'price_premium_monthly',
            pro: 'price_pro_monthly',
            team: 'price_team_monthly'
          },
          priceMatrix: {
            premium: { monthly: 'price_premium_monthly' },
            pro: { monthly: 'price_pro_monthly' },
            team: { monthly: 'price_team_monthly' }
          }
        })
      )
    );

    await gotoStable(page, '/app/billing');

    const buttons = [
      page.getByRole('button', { name: 'Choose Premium' }),
      page.getByRole('button', { name: 'Choose Pro' }),
      page.getByRole('button', { name: 'Choose Team' })
    ];

    const bottoms = await Promise.all(
      buttons.map(async button => {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        return (box?.y || 0) + (box?.height || 0);
      })
    );

    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
  });

  test('handles checkout return states and checkout initiation failures', async ({ page }) => {
    await setupLearnerContext(page);
    await setupBillingBaseRoutes(page);

    await page.route('**/api/v1/subscription/checkout', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill(mockJsonFailure(500, 'Stripe is temporarily unavailable.'));
    });

    await gotoStable(page, '/app/billing?checkout=cancel&plan=pro');
    await expect(page.getByText('Checkout was cancelled. No billing changes were applied.')).toBeVisible();

    await gotoStable(page, '/app/billing?checkout=success&plan=pro');
    await expect(page.getByText('Checkout completed. Subscription state is refreshing.')).toBeVisible();

    await gotoStable(page, '/app/billing');
    await expect(page.getByText('Manage your plan, track your study usage, and keep your practice on schedule.')).toBeVisible();
    await expect(page.getByText('Plan overview')).toBeVisible();
    await expect(page.getByText('Billing available')).toBeVisible();
    await expect(page.getByText('Your plan: free')).toBeVisible();
    await expect(page.getByText('test-mode')).toHaveCount(0);
    await expect(page.getByText('Billing + Entitlement')).toHaveCount(0);
    await expect(page.getByText('Mode: test')).toHaveCount(0);
    await expect(page.getByText(/Current:\s*free/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose Pro' }).click();
    await expect(page.getByText('Stripe is temporarily unavailable.')).toBeVisible();
  });

  test('silently recovers expired access tokens using refresh rotation', async ({ page }) => {
    await bootstrapSession(page);
    await mockUsageSummary(page);

    let appConfigCalls = 0;
    let refreshCalls = 0;

    await page.route('**/api/v1/app/config', route => {
      appConfigCalls += 1;

      if (appConfigCalls === 1) {
        return route.fulfill(mockJsonFailure(401, 'Access token expired'));
      }

      return route.fulfill(
        mockJsonSuccess({
          roles: [],
          subscriptionPlan: 'premium',
          usageSummary: {
            plan: 'premium',
            practiceCount: 2,
            testCount: 1,
            writingCount: 1,
            readingCount: 1,
            listeningCount: 1,
            aiRequestCount: 8,
            aiTokenCount: 22000,
            aiEstimatedCostUsd: 0.22,
            practiceLimit: 20,
            testLimit: 8,
            writingLimit: 12,
            readingLimit: 12,
            listeningLimit: 12,
            lastReset: new Date().toISOString()
          },
          enabledFeatureFlags: ['writing_module', 'reading_module', 'listening_module', 'full_exam_module', 'admin_suite'],
          featureFlags: {
            writing_module: { enabled: true, rolloutPercentage: 100 },
            reading_module: { enabled: true, rolloutPercentage: 100 },
            listening_module: { enabled: true, rolloutPercentage: 100 },
            full_exam_module: { enabled: true, rolloutPercentage: 100 },
            admin_suite: { enabled: true, rolloutPercentage: 100 }
          }
        })
      );
    });

    await page.route('**/api/v1/auth/refresh', async route => {
      refreshCalls += 1;
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill(
        mockJsonSuccess({
          accessToken: 'refreshed-access-token',
          refreshToken: 'refreshed-refresh-token',
          user: {
            _id: '507f1f77bcf86cd799439011',
            email: 'learner@example.com',
            firstName: 'Playwright',
            lastName: 'Learner',
            subscriptionPlan: 'premium',
            adminRoles: []
          }
        })
      );
    });

    await page.goto('/app/dashboard');

    await expect(page.getByRole('heading', { name: /(welcome back|dashboard)/i })).toBeVisible();
    expect(refreshCalls).toBeGreaterThanOrEqual(1);
    expect(refreshCalls).toBeLessThanOrEqual(5);
    expect(appConfigCalls).toBeGreaterThanOrEqual(1);

    const session = await page.evaluate(key => window.localStorage.getItem(key), sessionStorageKey);
    expect(session).toBeTruthy();
    const parsedSession = JSON.parse(session || '{}') as { accessToken?: string; refreshToken?: string };
    expect(parsedSession.accessToken).toBe('refreshed-access-token');
    expect(parsedSession.refreshToken).toBe('refreshed-refresh-token');
  });

  test('falls back to sign-in-required when refresh token is revoked', async ({ page }) => {
    await bootstrapSession(page);

    await page.route('**/api/v1/app/config', route => route.fulfill(mockJsonFailure(401, 'Access token expired')));

    await page.route('**/api/v1/auth/refresh', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill(mockJsonFailure(401, 'Refresh token invalid'));
    });

    await page.goto('/app/dashboard');

    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();

    const storedSession = await page.evaluate(key => window.localStorage.getItem(key), sessionStorageKey);
    expect(storedSession).toBeNull();
  });
});
