import { expect, test } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess } from './helpers/mockApi';

test.describe('Admin users operations', () => {
  test('updates roles and refreshes audit visibility', async ({ page }) => {
    await bootstrapSession(page, {
      email: 'admin@example.com',
      adminRoles: ['superadmin']
    });
    await mockAppConfig(page, {
      roles: ['superadmin']
    });

    let capturedRoles: string[] = [];

    await page.route('**/api/v1/admin/users?**', route =>
      route.fulfill(
        mockJsonSuccess({
          users: [
            {
              _id: '507f1f77bcf86cd799439021',
              email: 'staff@spokio.com',
              firstName: 'Support',
              lastName: 'Agent',
              subscriptionPlan: 'premium',
              adminRoles: ['support_agent']
            }
          ],
          total: 1
        })
      )
    );

    await page.route('**/api/v1/admin/audit-logs?**', route =>
      route.fulfill(
        mockJsonSuccess({
          logs: [
            {
              _id: 'audit-1',
              actorUserId: '507f1f77bcf86cd799439011',
              action: 'admin.users.roles.update',
              targetType: 'user',
              targetId: '507f1f77bcf86cd799439021',
              createdAt: '2026-02-01T11:00:00.000Z'
            }
          ],
          total: 1,
          limit: 50,
          offset: 0
        })
      )
    );

    await page.route('**/api/v1/admin/users/*/roles', async route => {
      const payload = route.request().postDataJSON() as { roles?: string[] };
      capturedRoles = payload.roles || [];
      await route.fulfill(mockJsonSuccess({ updated: true }));
    });

    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: /Role management and operational audit logs/i })).toBeVisible();
    const userRow = page.getByRole('row', { name: /staff@spokio\.com/i });
    await expect(userRow).toBeVisible();

    await userRow.getByLabel('content_manager').check();
    await userRow.getByRole('button', { name: 'Save Roles' }).click();

    await expect(page.getByText('User roles updated.')).toBeVisible();
    expect(capturedRoles).toContain('content_manager');
    expect(capturedRoles).toContain('support_agent');
    await expect(page.getByRole('cell', { name: 'admin.users.roles.update' })).toBeVisible();
  });

  test('prefills deep-link filters from overview and alerts', async ({ page }) => {
    await bootstrapSession(page, {
      email: 'admin@example.com',
      adminRoles: ['superadmin']
    });
    await mockAppConfig(page, {
      roles: ['superadmin']
    });

    let usersRequestUrl = '';
    let auditRequestUrl = '';

    await page.route('**/api/v1/admin/users?**', route => {
      usersRequestUrl = route.request().url();
      return route.fulfill(
        mockJsonSuccess({
          users: [],
          total: 0,
          limit: 50,
          offset: 0
        })
      );
    });

    await page.route('**/api/v1/admin/audit-logs?**', route => {
      auditRequestUrl = route.request().url();
      return route.fulfill(
        mockJsonSuccess({
          logs: [],
          total: 0,
          limit: 50,
          offset: 0
        })
      );
    });

    await page.goto('/admin/users?query=learner%40example.com&auditAction=payment_failed&dateFrom=2026-02-01&dateTo=2026-02-28');

    await expect(page.getByPlaceholder('Search users by email/name/id')).toHaveValue('learner@example.com');
    await expect(page.getByLabel('Action filter')).toHaveValue('payment_failed');
    await expect(page.getByLabel('Date from')).toHaveValue('2026-02-01');
    await expect(page.getByLabel('Date to')).toHaveValue('2026-02-28');

    await expect.poll(() => usersRequestUrl).toContain('query=learner%40example.com');
    await expect.poll(() => auditRequestUrl).toContain('action=payment_failed');
    await expect.poll(() => auditRequestUrl).toContain('dateFrom=2026-02-01');
    await expect.poll(() => auditRequestUrl).toContain('dateTo=2026-02-28');
  });
});
