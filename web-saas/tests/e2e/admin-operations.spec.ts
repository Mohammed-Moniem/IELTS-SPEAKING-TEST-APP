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

    const confirmationPanel = page.locator('.panel').filter({
      has: page.getByRole('heading', { name: 'High-impact confirmation required' })
    });
    await expect(confirmationPanel).toBeVisible();
    await expect(confirmationPanel.locator('input.input').first()).toBeVisible();

    const confirmationPrompt = await confirmationPanel.getByText(/Type exactly:/).innerText();
    const expectedConfirmation = confirmationPrompt.replace('Type exactly:', '').trim();
    await confirmationPanel.locator('input.input').first().fill(expectedConfirmation);
    await confirmationPanel.getByRole('button', { name: 'Confirm Change' }).click();

    await expect
      .poll(() => patchCalls.some(call => call.key === 'writing_module' && call.rolloutPercentage === 55))
      .toBe(true);
    await expect.poll(() => patchCalls.some(call => call.key === 'full_exam_module')).toBe(true);
  });

  test('supports payout preview and payout batch detail inspection', async ({ page }) => {
    await setupSuperAdmin(page);

    await page.route('**/api/v1/admin/partners?**', route =>
      route.fulfill(
        mockJsonSuccess({
          partners: [
            {
              _id: 'partner-1',
              displayName: 'English Lab',
              partnerType: 'influencer',
              status: 'active',
              ownerUserId: 'owner-1',
              defaultCommissionRate: 12,
              createdAt: '2026-01-01T10:00:00.000Z'
            }
          ],
          total: 1
        })
      )
    );
    await page.route('**/api/v1/admin/partners/partner-1/codes?**', route =>
      route.fulfill(mockJsonSuccess({ partnerId: 'partner-1', total: 0, limit: 100, offset: 0, codes: [] }))
    );
    await page.route('**/api/v1/admin/partners/partner-1/targets?**', route =>
      route.fulfill(mockJsonSuccess({ partnerId: 'partner-1', total: 0, limit: 100, offset: 0, targets: [] }))
    );
    await page.route('**/api/v1/admin/partners/payout-batches?**', route =>
      route.fulfill(
        mockJsonSuccess({
          total: 1,
          limit: 100,
          offset: 0,
          batches: [
            {
              _id: 'batch-1',
              periodStart: '2026-02-01T00:00:00.000Z',
              periodEnd: '2026-02-28T23:59:59.999Z',
              status: 'draft',
              partnerCount: 2,
              totals: { commissionUsd: 4200, bonusUsd: 250, totalUsd: 4450 },
              createdAt: '2026-03-01T10:00:00.000Z'
            }
          ]
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

    await page.goto('/admin/partners');
    await page.getByPlaceholder('2026-02-01').fill('2026-02-01');
    await page.getByPlaceholder('2026-02-28').fill('2026-02-28');
    await page.getByRole('button', { name: 'Preview batch' }).click();

    await expect(page.getByText('Payout preview generated')).toBeVisible();
    await expect(page.getByText('Flagged accounts: 1')).toBeVisible();

    await page.getByRole('row', { name: /batch-1/i }).getByRole('button', { name: 'Open' }).click();
    await expect(page.getByRole('heading', { name: 'Payout batch detail' })).toBeVisible();
    await expect(page.getByText('Batch: batch-1')).toBeVisible();
  });
});
