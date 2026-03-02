import { expect, test } from '@playwright/test';

const COOKIE_NAME = 'spokio_mkt_motion_v1';

test.describe('marketing motion variant middleware', () => {
  test('query override assigns motion variant cookie and cleans URL', async ({ context, page }) => {
    await page.goto('/?mkt_variant=motion');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('motion');
  });

  test('query override assigns control variant cookie and cleans URL', async ({ context, page }) => {
    await page.goto('/pricing?mkt_variant=control');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/pricing');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('control');
  });
});
