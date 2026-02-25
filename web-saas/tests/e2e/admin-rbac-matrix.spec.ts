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
    heading: 'Operational command center',
    allowedRoles: ['superadmin', 'content_manager', 'support_agent']
  },
  {
    path: '/admin/analytics',
    heading: 'Module and subscription performance',
    allowedRoles: ['superadmin', 'content_manager', 'support_agent']
  },
  {
    path: '/admin/content',
    heading: 'Typed content editors for writing, reading, and listening',
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
    heading: 'Partner management',
    allowedRoles: ['superadmin']
  },
  {
    path: '/admin/ai-cost',
    heading: 'Filtered AI request and spend visibility',
    allowedRoles: ['superadmin']
  },
  {
    path: '/admin/flags',
    heading: 'Feature flags with safety confirmation gates',
    allowedRoles: ['superadmin']
  }
];

const mockAdminApis = async (page: Page) => {
  await page.route('**/api/v1/admin/analytics', route =>
    route.fulfill(
      mockJsonSuccess({
        users: 12,
        moduleActivity: {
          writingSubmissions: 3,
          readingAttempts: 4,
          listeningAttempts: 5
        },
        activePaidSubscriptions: 7,
        featureFlags: [{ key: 'admin_suite', enabled: true }]
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
