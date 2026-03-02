import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

const setupSuperAdmin = async (page: Page) => {
  await bootstrapSession(page, {
    email: 'admin@example.com',
    adminRoles: ['superadmin'],
    subscriptionPlan: 'pro'
  });
  await mockAppConfig(page, { roles: ['superadmin'], subscriptionPlan: 'pro' });
};

test.describe('Admin operations hardening', () => {
  test('supports typed content editor create and update flow', async ({ page }) => {
    await setupSuperAdmin(page);

    type WritingRecord = {
      _id: string;
      [key: string]: unknown;
    };

    const writingContentId = 'content-writing-1';
    let records: WritingRecord[] = [
      {
        _id: writingContentId,
        track: 'academic',
        taskType: 'task2',
        title: 'City Planning Essay',
        prompt: 'Discuss effects of city expansion.',
        instructions: ['Support your points with examples.'],
        minimumWords: 250,
        suggestedTimeMinutes: 40
      }
    ];

    let createdPayload: Record<string, unknown> | null = null;
    let patchedPayload: Record<string, unknown> | null = null;

    await page.route('**/api/v1/admin/content/writing?**', route => route.fulfill(mockJsonSuccess(records)));

    await page.route('**/api/v1/admin/content', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      const body = route.request().postDataJSON() as { payload?: Record<string, unknown> };
      createdPayload = body.payload || null;

      records = [
        ...records,
        {
          _id: 'content-writing-2',
          ...(body.payload || {})
        }
      ];

      return route.fulfill(mockJsonSuccess({ created: true }, 201));
    });

    await page.route('**/api/v1/admin/content/writing/*', async route => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback();
      }

      const body = route.request().postDataJSON() as { payload?: Record<string, unknown> };
      patchedPayload = body.payload || null;

      records = records.map(record =>
        record._id === writingContentId
          ? {
              ...record,
              ...(body.payload || {})
            }
          : record
      );

      return route.fulfill(mockJsonSuccess({ updated: true }));
    });

    await page.goto('/admin/content');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Title and prompt are required for writing content.')).toBeVisible();

    await page.getByLabel('Title').fill('New Writing Task');
    await page.getByLabel('Prompt').fill('Do remote jobs improve quality of life?');
    await page.getByLabel('Instructions (one line per instruction)').fill('Give reasons\nAdd examples');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('row', { name: /New Writing Task/ })).toBeVisible();
    expect(createdPayload).toMatchObject({
      title: 'New Writing Task',
      taskType: 'task2',
      minimumWords: 250
    });

    await page.getByRole('button', { name: 'Load Content' }).click();
    await expect(page.getByRole('row', { name: /City Planning Essay/ })).toBeVisible();

    await page.getByRole('row', { name: /City Planning Essay/ }).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Target ID (for update)').first()).toHaveValue(writingContentId);

    await page.getByLabel('Title').fill('Updated City Planning Essay');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('row', { name: /Updated City Planning Essay/ })).toBeVisible();
    expect(patchedPayload).toMatchObject({
      title: 'Updated City Planning Essay'
    });
  });

  test('requires confirmation for high-impact flags and applies standard updates directly', async ({ page }) => {
    await setupSuperAdmin(page);

    let flags = [
      {
        key: 'writing_module',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Writing rollout'
      },
      {
        key: 'full_exam_module',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Full exam rollout'
      }
    ];

    const patchCalls: Array<{ key: string; enabled?: boolean; rolloutPercentage?: number }> = [];

    await page.route('**/api/v1/admin/feature-flags', route => route.fulfill(mockJsonSuccess(flags)));

    await page.route('**/api/v1/admin/feature-flags/*', async route => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback();
      }

      const body = route.request().postDataJSON() as { enabled?: boolean; rolloutPercentage?: number };
      const key = route.request().url().split('/').pop() || '';
      patchCalls.push({ key, enabled: body.enabled, rolloutPercentage: body.rolloutPercentage });

      flags = flags.map(flag =>
        flag.key === key
          ? {
              ...flag,
              enabled: typeof body.enabled === 'boolean' ? body.enabled : flag.enabled,
              rolloutPercentage:
                typeof body.rolloutPercentage === 'number' ? body.rolloutPercentage : flag.rolloutPercentage
            }
          : flag
      );

      return route.fulfill(
        mockJsonSuccess({
          key,
          enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
          rolloutPercentage: body.rolloutPercentage ?? 100
        })
      );
    });

    await page.goto('/admin/flags');

    const writingRow = page.getByRole('row', { name: /writing_module/i });
    await writingRow.locator('input[type="number"]').fill('55');
    await writingRow.locator('input[type="number"]').press('Tab');

    await expect(page.getByText('Updated writing_module')).toBeVisible();

    const fullExamRow = page.getByRole('row', { name: /full_exam_module/i });
    await fullExamRow.getByRole('button', { name: 'Toggle' }).click();

    const confirmationPanel = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'High-Impact Confirmation Required' })
    });
    await expect(confirmationPanel).toBeVisible();
    const confirmationInput = confirmationPanel.locator('input').first();
    await expect(confirmationInput).toBeVisible();

    const expectedConfirmation = await confirmationPanel.locator('code').innerText();
    await confirmationInput.fill(expectedConfirmation);
    await confirmationPanel.getByRole('button', { name: 'Confirm Change' }).click();

    await expect
      .poll(() => patchCalls.some(call => call.key === 'writing_module' && call.rolloutPercentage === 55))
      .toBe(true);
    await expect.poll(() => patchCalls.some(call => call.key === 'full_exam_module')).toBe(true);
  });

  test('supports payout preview and payout batch detail inspection', async ({ page }) => {
    await setupSuperAdmin(page);

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
              partnerName: 'TechFlow Inc.',
              partnerType: 'institute',
              status: 'pending',
              paymentStatus: 'pending',
              paymentMethod: 'Bank Transfer',
              attributedRevenueUsd: 12500,
              commissionRatePercent: 20,
              calculatedPayoutUsd: 2500,
              payoutBreakdown: { unpaidUsd: 2500, processingUsd: 0, paidUsd: 0 },
              conversionCount: 42,
              contactEmail: 'team@techflow.edu'
            },
            {
              partnerId: 'partner-2',
              partnerName: 'AlphaStream',
              partnerType: 'influencer',
              status: 'processing',
              paymentStatus: 'processing',
              paymentMethod: 'Stripe Connect',
              attributedRevenueUsd: 8240,
              commissionRatePercent: 15,
              calculatedPayoutUsd: 1236,
              payoutBreakdown: { unpaidUsd: 0, processingUsd: 1236, paidUsd: 0 },
              conversionCount: 18,
              contactEmail: 'ops@alphastream.io'
            }
          ],
          total: 2,
          limit: 50,
          offset: 0
        })
      )
    );
    await page.route('**/api/v1/admin/partners/payout-batches/preview', route =>
      route.fulfill(
        mockJsonSuccess({
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          partnerCount: 2,
          totals: { commissionUsd: 4200, bonusUsd: 250, totalUsd: 4450 },
          preflight: {
            processingFeeUsd: 8.9,
            flaggedAccounts: [
              {
                partnerId: 'partner-1',
                partnerName: 'English Lab',
                amountUsd: 3200,
                status: 'review_required',
                riskFactors: ['high_payout_amount']
              }
            ],
            riskSummary: {
              flaggedCount: 1,
              flaggedAmountUsd: 3200
            }
          }
        })
      )
    );
    await page.route('**/api/v1/admin/partners/payout-batches/batch-1', route =>
      route.fulfill(
        mockJsonSuccess({
          batch: {
            _id: 'batch-1',
            periodStart: '2026-02-01T00:00:00.000Z',
            periodEnd: '2026-02-28T23:59:59.999Z',
            status: 'draft',
            partnerCount: 2,
            totals: { commissionUsd: 4200, bonusUsd: 250, totalUsd: 4450 },
            createdAt: '2026-03-01T10:00:00.000Z'
          },
          items: [],
          preflight: {
            processingFeeUsd: 8.9,
            flaggedAccounts: [],
            riskSummary: { flaggedCount: 0, flaggedAmountUsd: 0 }
          }
        })
      )
    );
    await page.route('**/api/v1/admin/partners/payout-batches', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill(mockJsonSuccess({ batch: { _id: 'batch-1' } }, 201));
    });

    await page.goto('/admin/partners');
    await page.getByRole('button', { name: /Process Batch/ }).click();

    await expect(page.getByRole('dialog', { name: 'Payout confirmation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirm Payout Batch' })).toBeVisible();
    await expect(page.getByText('Action Required: Flagged Accounts Detected')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Flagged Accounts' })).toBeVisible();

    const confirmButton = page.getByRole('button', { name: 'Confirm & Execute Payout' });
    await expect(confirmButton).toBeDisabled();
    await page
      .getByText('I have verified the commission logic and reviewed all flagged accounts.')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByText('Payout batch created successfully.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Confirm Payout Batch #batch-1/i })).toBeVisible();
  });

  test('wires admin search, bell feed, and overview quick actions', async ({ page }) => {
    await setupSuperAdmin(page);

    const flagUpdates: string[] = [];

    await page.route('**/api/v1/admin/overview-view?**', route => {
      const url = new URL(route.request().url());
      const window = url.searchParams.get('window');
      const payload = {
        window: window === '24h' ? '24h' : '1h',
        kpis: {
          activeUsers: 250,
          estimatedRevenueUsd: 4200,
          aiCostUsd: 180,
          platformHealthPercent: 99.3
        },
        kpiDeltas: {
          activeUsers: { current: 250, previous: 200, deltaPercent: 25, direction: 'up' },
          estimatedRevenueUsd: { current: 4200, previous: 4000, deltaPercent: 5, direction: 'up' },
          aiCostUsd: { current: 180, previous: 210, deltaPercent: -14.29, direction: 'down' },
          platformHealthPercent: { current: 99.3, previous: 98.9, deltaPercent: 0.4, direction: 'up' }
        },
        latencySeries: [
          { label: 't1', value: 10 },
          { label: 't2', value: 20 }
        ],
        featureFlagSummary: [
          { key: 'growth_blog_v1', enabled: true, rolloutPercentage: 100 },
          { key: 'growth_geo_v1', enabled: true, rolloutPercentage: 100 }
        ],
        alerts: [
          {
            id: 'alert-1',
            action: 'payment_failed',
            targetType: 'subscription',
            targetId: '507f1f77bcf86cd799439011',
            createdAt: new Date().toISOString(),
            severity: 'critical',
            details: { invoiceId: 'inv_1' }
          },
          {
            id: 'alert-2',
            action: 'campaign_sent',
            targetType: 'notification',
            createdAt: new Date().toISOString(),
            severity: 'info',
            details: {}
          }
        ],
        deployments: [
          {
            id: 'dep-1',
            name: 'web-release-123',
            status: 'success',
            createdAt: new Date().toISOString()
          }
        ]
      };
      return route.fulfill(mockJsonSuccess(payload));
    });

    await page.route('**/api/v1/admin/feature-flags', route =>
      route.fulfill(
        mockJsonSuccess([
          { key: 'growth_blog_v1', enabled: true, rolloutPercentage: 100, description: 'Growth blog flag' }
        ])
      )
    );
    await page.route('**/api/v1/admin/feature-flags/*', async route => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback();
      }
      const flagKey = route.request().url().split('/').pop() || '';
      flagUpdates.push(flagKey);
      return route.fulfill(mockJsonSuccess({ key: flagKey, enabled: false, rolloutPercentage: 100 }));
    });

    await page.route('**/api/v1/admin/analytics-view?**', route =>
      route.fulfill(
        mockJsonSuccess({
          range: '30d',
          kpis: { totalRevenueUsd: 1000, activeUsersDaily: 20, avgTokenCostUsd: 0.02, grossMarginPercent: 60 },
          kpiDeltas: {
            totalRevenueUsd: { current: 1000, previous: 900, deltaPercent: 11.1, direction: 'up' },
            activeUsersDaily: { current: 20, previous: 18, deltaPercent: 11.1, direction: 'up' },
            avgTokenCostUsd: { current: 0.02, previous: 0.021, deltaPercent: -4.76, direction: 'down' },
            grossMarginPercent: { current: 60, previous: 58, deltaPercent: 3.45, direction: 'up' }
          },
          trafficSeries: [],
          aiExpenditure: { totalCostUsd: 10, totalRequests: 5, byModule: [] },
          partnerPerformance: [],
          apiHealth: [],
          funnel: [],
          cohortSlices: {
            plan: { free: 0, premium: 0, pro: 0, team: 0 },
            modulePreference: { speaking: 0, writing: 0, reading: 0, listening: 0 },
            acquisitionChannel: { direct: 0, partner_register: 0, partner_checkout: 0, partner_manual: 0 }
          }
        })
      )
    );

    await page.route('**/api/v1/admin/users?**', route =>
      route.fulfill(
        mockJsonSuccess({
          users: [],
          total: 0,
          limit: 50,
          offset: 0
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
    await page.route('**/api/v1/admin/subscriptions?**', route =>
      route.fulfill(
        mockJsonSuccess({
          subscriptions: [],
          total: 0,
          limit: 50,
          offset: 0
        })
      )
    );

    await page.goto('/admin/overview');

    await page.getByRole('button', { name: 'Details' }).first().click();
    await expect(page.getByRole('heading', { name: 'Alert Details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: '+ Manage Flags' }).click();
    await expect(page).toHaveURL(/\/admin\/flags$/);

    await page.goto('/admin/overview');
    await page.getByRole('button', { name: 'View Logs' }).click();
    await expect(page).toHaveURL(/\/admin\/users\?auditAction=deployment/);

    await page.goto('/admin/overview');
    await page.getByRole('button', { name: 'Rollback' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Growth Rollback' })).toBeVisible();
    await page.getByRole('button', { name: 'Disable Growth Flags' }).click();
    await expect
      .poll(() => flagUpdates.filter(flag => flag.startsWith('growth_')).length)
      .toBe(5);

    await page.goto('/admin/overview');
    await page.getByLabel('Open system alerts').click();
    await expect(page.getByText('System Alerts')).toBeVisible();
    await expect(page.getByRole('link', { name: /payment_failed/i }).first()).toBeVisible();

    const searchInput = page.getByPlaceholder('Search routes, user email, or id...');
    await searchInput.fill('analytics');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/admin\/analytics$/);

    await searchInput.fill('learner@example.com');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/admin\/users\?query=learner%40example\.com/);

    await searchInput.fill('billing');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/admin\/subscriptions\?query=billing/);
  });
});
