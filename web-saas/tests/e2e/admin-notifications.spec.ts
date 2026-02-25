import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

type Campaign = {
  _id: string;
  title: string;
  body: string;
  type: 'system' | 'offer';
  status: 'draft' | 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';
  audience: {
    kind: string;
  };
  deliverySummary?: {
    targetedUsers: number;
    attempts: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  createdAt: string;
  updatedAt: string;
};

const setupSuperAdmin = async (page: Page) => {
  await bootstrapSession(page, {
    email: 'admin@example.com',
    adminRoles: ['superadmin'],
    subscriptionPlan: 'pro'
  });
  await mockAppConfig(page, { roles: ['superadmin'], subscriptionPlan: 'pro' });
};

const wireCampaignRoutes = async (page: Page) => {
  let campaigns: Campaign[] = [];

  const getDetailPayload = (id: string) => {
    const campaign = campaigns.find(item => item._id === id);
    if (!campaign) {
      return null;
    }
    return {
      campaign,
      deliveries: [],
      totalDeliveries: 0,
      breakdown: {
        byStatus: [],
        byChannel: []
      }
    };
  };

  await page.route('**/api/v1/admin/notifications/campaigns?**', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        campaigns,
        total: campaigns.length,
        limit: 100,
        offset: 0
      })
    );
  });

  await page.route('**/api/v1/admin/notifications/campaigns', async route => {
    if (route.request().method() === 'POST' && route.request().url().endsWith('/preflight')) {
      return route.fallback();
    }
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    const payload = route.request().postDataJSON() as {
      title: string;
      body: string;
      type: 'system' | 'offer';
      mode?: 'immediate' | 'scheduled';
      audience: { kind: string };
    };

    const id = `campaign-${campaigns.length + 1}`;
    const created: Campaign = {
      _id: id,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      status: payload.mode === 'scheduled' ? 'scheduled' : 'draft',
      audience: payload.audience,
      deliverySummary: { targetedUsers: 0, attempts: 0, sent: 0, failed: 0, skipped: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    campaigns = [created, ...campaigns];

    return route.fulfill(
      mockJsonSuccess({
        campaign: created,
        deliveries: [],
        totalDeliveries: 0,
        breakdown: { byStatus: [], byChannel: [] }
      }, 201)
    );
  });

  await page.route('**/api/v1/admin/notifications/campaigns/preflight', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        audienceEstimate: {
          targetedUsers: 120
        },
        safety: {
          frequencyCapOk: true,
          linkValidationOk: true,
          scheduleReady: true,
          warnings: []
        }
      })
    );
  });

  await page.route('**/api/v1/admin/notifications/campaigns/*/send-now', async route => {
    const campaignId = route.request().url().split('/').slice(-2, -1)[0];
    campaigns = campaigns.map(item =>
      item._id === campaignId
        ? {
            ...item,
            status: 'sent',
            deliverySummary: { targetedUsers: 20, attempts: 20, sent: 20, failed: 0, skipped: 0 }
          }
        : item
    );

    const detail = getDetailPayload(campaignId);
    return route.fulfill(mockJsonSuccess(detail));
  });

  await page.route('**/api/v1/admin/notifications/campaigns/*/cancel', async route => {
    const campaignId = route.request().url().split('/').slice(-2, -1)[0];
    campaigns = campaigns.map(item =>
      item._id === campaignId
        ? {
            ...item,
            status: 'cancelled'
          }
        : item
    );

    const detail = getDetailPayload(campaignId);
    return route.fulfill(mockJsonSuccess(detail));
  });

  await page.route('**/api/v1/admin/notifications/campaigns/*', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }
    const campaignId = route.request().url().split('/').pop() || '';
    const detail = getDetailPayload(campaignId);
    if (!detail) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, status: 404, message: 'Not found', timestamp: new Date().toISOString() })
      });
    }

    return route.fulfill(mockJsonSuccess(detail));
  });
};

test.describe('Admin notification campaigns', () => {
  test('blocks non-superadmin users from admin notifications page', async ({ page }) => {
    await bootstrapSession(page, {
      email: 'manager@example.com',
      adminRoles: ['content_manager'],
      subscriptionPlan: 'pro'
    });
    await mockAppConfig(page, { roles: ['content_manager'], subscriptionPlan: 'pro' });

    await page.goto('/admin/notifications');
    await expect(page.getByRole('heading', { name: /Insufficient admin permissions/i })).toBeVisible();
    await expect(page.getByText(/does not have access to this admin section/i)).toBeVisible();
  });

  test('creates immediate campaign and sends now', async ({ page }) => {
    await setupSuperAdmin(page);
    await wireCampaignRoutes(page);

    await page.goto('/admin/notifications');

    await page.getByLabel('Title').fill('Global Offer');
    await page.getByLabel('Body').fill('Limited-time premium discount');
    await page.getByRole('button', { name: 'Run Preflight' }).click();
    await expect(page.getByText('Preflight completed')).toBeVisible();
    await expect(page.getByText('Targeted users: 120')).toBeVisible();
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    await expect(page.getByText('Campaign created')).toBeVisible();
    await expect(page.getByRole('row', { name: /Global Offer/ })).toBeVisible();

    await page.getByRole('row', { name: /Global Offer/ }).getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByText('Campaign sent')).toBeVisible();
  });

  test('creates scheduled campaign and cancels it', async ({ page }) => {
    await setupSuperAdmin(page);
    await wireCampaignRoutes(page);

    await page.goto('/admin/notifications');
    await page.getByLabel('Title').fill('Partner Schedule');
    await page.getByLabel('Body').fill('Partner-only offer details');
    await page.getByLabel('Mode').selectOption('scheduled');
    await page.getByLabel('Scheduled At (UTC)').fill('2026-12-10T10:30');
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    await expect(page.getByRole('row', { name: /Partner Schedule/ })).toBeVisible();
    await page.getByRole('row', { name: /Partner Schedule/ }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Campaign cancelled')).toBeVisible();
  });
});
