import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

type AdminRole = 'superadmin' | 'content_manager' | 'support_agent';

type AdminRouteExpectation = {
  path: string;
  heading: string;
  allowedRoles: AdminRole[];
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
        message.includes('interrupted by another navigation') || message.includes('NS_BINDING_ABORTED');

      if (!isTransientNavigationIssue || attempt === maxAttempts) {
        throw error;
      }

      await page.waitForTimeout(200);
    }
  }
};

const adminRouteExpectations: AdminRouteExpectation[] = [
  {
    path: '/admin/overview',
    heading: 'Dashboard / Overview',
    allowedRoles: ['superadmin', 'content_manager', 'support_agent']
  },
  {
    path: '/admin/analytics',
    heading: 'Analytics & Costs',
    allowedRoles: ['superadmin', 'content_manager', 'support_agent']
  },
  {
    path: '/admin/content',
    heading: 'Typed Content Editors for Writing, Reading, and Listening',
    allowedRoles: ['superadmin', 'content_manager']
  },
  {
    path: '/admin/users',
    heading: 'Role management and operational audit logs',
    allowedRoles: ['superadmin', 'support_agent']
  },
  {
    path: '/admin/subscriptions',
    heading: 'Admin subscriptions',
    allowedRoles: ['superadmin', 'support_agent']
  },
  {
    path: '/admin/partners',
    heading: 'Partner Payout Operations',
    allowedRoles: ['superadmin']
  },
  {
    path: '/admin/ai-cost',
    heading: 'Analytics & Costs',
    allowedRoles: ['superadmin']
  },
  {
    path: '/admin/flags',
    heading: 'Feature Flags with Safety Confirmation Gates',
    allowedRoles: ['superadmin']
  }
];

const mockAdminApis = async (page: Page) => {
  await page.route('**/api/v1/admin/overview-view?**', route =>
    route.fulfill(
      mockJsonSuccess({
        kpis: {
          activeUsers: 12458,
          estimatedRevenueUsd: 45230,
          aiCostUsd: 2840,
          platformHealthPercent: 99.98
        },
        latencySeries: [
          { label: '10:00', value: 420 },
          { label: '10:10', value: 510 },
          { label: '10:20', value: 470 }
        ],
        alerts: [
          { id: 'alert-1', action: 'payment timeout', targetType: 'stripe', createdAt: '2026-02-22T16:00:00.000Z' }
        ],
        deployments: [
          { id: 'dep-1', name: 'Production', status: 'success', createdAt: '2026-02-22T15:00:00.000Z' }
        ],
        featureFlagSummary: [{ key: 'admin_suite', enabled: true, rolloutPercentage: 100 }]
      })
    )
  );

  await page.route('**/api/v1/admin/analytics-view?**', route =>
    route.fulfill(
      mockJsonSuccess({
        kpis: {
          totalRevenueUsd: 24592,
          activeUsersDaily: 1842,
          avgTokenCostUsd: 0.042,
          grossMarginPercent: 68.4
        },
        trafficSeries: [
          { label: 'Oct 1', activeUsers: 620, submissions: 310 },
          { label: 'Oct 8', activeUsers: 890, submissions: 520 },
          { label: 'Oct 15', activeUsers: 1210, submissions: 790 }
        ],
        aiExpenditure: {
          totalCostUsd: 4200,
          totalRequests: 1200,
          byModule: [
            { module: 'Speaking (STT/TTS)', costUsd: 2730, requests: 700 },
            { module: 'Writing (LLM)', costUsd: 1470, requests: 500 }
          ]
        },
        partnerPerformance: [
          {
            partnerId: 'partner-1',
            partnerName: 'English Lab',
            touches: 1240,
            conversions: 186,
            conversionRatePercent: 15,
            revenueUsd: 37500,
            commissionUsd: 4200
          }
        ],
        apiHealth: [
          { module: 'OpenAI (GPT-4)', total: 1000, successRatePercent: 99.9, blockedCount: 0, errorCount: 1 },
          { module: 'Deepgram (STT)', total: 800, successRatePercent: 98.5, blockedCount: 0, errorCount: 12 }
        ],
        funnel: [
          { key: 'visit', label: 'Visit', count: 2100, conversionFromPreviousPercent: 100 },
          { key: 'register', label: 'Register', count: 760, conversionFromPreviousPercent: 36.19 },
          { key: 'first_practice', label: 'First Practice', count: 540, conversionFromPreviousPercent: 71.05 },
          { key: 'first_paid', label: 'First Paid', count: 120, conversionFromPreviousPercent: 22.22 },
          { key: 'retained_30d', label: '30-Day Retention', count: 88, conversionFromPreviousPercent: 73.33 }
        ],
        cohortSlices: {
          plan: { free: 420, premium: 210, pro: 102, team: 28 },
          modulePreference: { speaking: 250, writing: 180, reading: 170, listening: 160 },
          acquisitionChannel: { direct: 530, partner_register: 140, partner_checkout: 60, partner_manual: 30 }
        }
      })
    )
  );

  await page.route('**/api/v1/admin/ai-usage?**', route =>
    route.fulfill(
      mockJsonSuccess({
        aggregate: [],
        recentLogs: []
      })
    )
  );

  await page.route('**/api/v1/admin/users?**', route =>
    route.fulfill(
      mockJsonSuccess({
        users: [],
        total: 0
      })
    )
  );

  await page.route('**/api/v1/admin/audit-logs?**', route =>
    route.fulfill(
      mockJsonSuccess({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      })
    )
  );

  await page.route('**/api/v1/admin/users/*/roles', route =>
    route.fulfill(
      mockJsonSuccess({
        updated: true
      })
    )
  );

  await page.route('**/api/v1/admin/subscriptions?**', route =>
    route.fulfill(
      mockJsonSuccess({
        subscriptions: [],
        total: 0
      })
    )
  );

  await page.route('**/api/v1/admin/content/**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill(mockJsonSuccess([]));
    }
    return route.fulfill(mockJsonSuccess({ ok: true }));
  });

  await page.route('**/api/v1/admin/content', route => {
    if (route.request().method() === 'POST') {
      return route.fulfill(mockJsonSuccess({ created: true }, 201));
    }
    return route.fallback();
  });

  const featureFlags = [
    {
      key: 'admin_suite',
      enabled: true,
      rolloutPercentage: 100,
      description: 'Admin suite flag'
    }
  ];

  await page.route('**/api/v1/admin/feature-flags', route => route.fulfill(mockJsonSuccess(featureFlags)));
  await page.route('**/api/v1/admin/feature-flags/*', route =>
    route.fulfill(
      mockJsonSuccess({
        key: 'admin_suite',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Admin suite flag'
      })
    )
  );

  const partnerId = 'partner-1';
  await page.route('**/api/v1/admin/partners?**', route =>
    route.fulfill(
      mockJsonSuccess({
        partners: [
          {
            _id: partnerId,
            displayName: 'Partner One',
            partnerType: 'influencer',
            status: 'active',
            ownerUserId: 'owner-1',
            defaultCommissionRate: 10,
            createdAt: '2026-02-01T00:00:00.000Z'
          }
        ],
        total: 1
      })
    )
  );

  await page.route('**/api/v1/admin/partners/*/codes?**', route =>
    route.fulfill(
      mockJsonSuccess({
        partnerId,
        total: 0,
        limit: 100,
        offset: 0,
        codes: []
      })
    )
  );

  await page.route('**/api/v1/admin/partners/*/targets?**', route =>
    route.fulfill(
      mockJsonSuccess({
        partnerId,
        total: 0,
        limit: 100,
        offset: 0,
        targets: []
      })
    )
  );

  await page.route('**/api/v1/admin/partners/payout-batches?**', route =>
    route.fulfill(
      mockJsonSuccess({
        total: 0,
        limit: 100,
        offset: 0,
        batches: []
      })
    )
  );

  await page.route('**/api/v1/admin/partners/payout-operations-view?**', route =>
    route.fulfill(
      mockJsonSuccess({
        summary: {
          pendingPayoutUsd: 124592,
          pendingChangePercent: 12.5,
          nextBatchDate: '2026-03-31T00:00:00.000Z',
          nextBatchCountdownDays: 4,
          totalPaidLtmUsd: 1200000,
          totalPaidChangePercent: 5.2
        },
        rows: [
          {
            partnerId: 'partner-1',
            partnerName: 'Partner One',
            partnerType: 'influencer',
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: 'Bank Transfer',
            attributedRevenueUsd: 12500,
            commissionRatePercent: 10,
            calculatedPayoutUsd: 1250,
            payoutBreakdown: { unpaidUsd: 1250, processingUsd: 0, paidUsd: 0 },
            conversionCount: 42,
            contactEmail: 'ops@partner.one'
          }
        ],
        total: 1,
        limit: 50,
        offset: 0
      })
    )
  );
};

const setupRole = async (page: Page, role: AdminRole) => {
  await bootstrapSession(page, {
    email: `${role}@example.com`,
    adminRoles: [role],
    subscriptionPlan: 'pro'
  });
  await mockAppConfig(page, {
    roles: [role],
    subscriptionPlan: 'pro'
  });
  await mockAdminApis(page);
};

test.describe('Admin RBAC route matrix', () => {
  const roles: AdminRole[] = ['superadmin', 'content_manager', 'support_agent'];

  for (const role of roles) {
    test(`enforces admin route permissions for ${role}`, async ({ page }) => {
      await setupRole(page, role);

      for (const route of adminRouteExpectations) {
        await gotoStable(page, route.path);

        if (route.allowedRoles.includes(role)) {
          await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Insufficient admin permissions' })).toHaveCount(0);
        } else {
          await expect(page.getByRole('heading', { name: 'Insufficient admin permissions' })).toBeVisible();
        }
      }
    });
  }
});
