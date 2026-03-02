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

  test('query override works for additional static marketing routes', async ({ context, page }) => {
    await page.goto('/advertise?mkt_variant=motion');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/advertise');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('motion');
  });

  test('query override works for ielts listing route', async ({ context, page }) => {
    await page.goto('/ielts?mkt_variant=motion');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/ielts');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('motion');
  });

  test('query override works for dynamic marketing routes', async ({ context, page }) => {
    await page.goto('/blog/example-slug?mkt_variant=motion');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/blog/example-slug');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('motion');
  });

  test('query override works for auth marketing routes', async ({ context, page }) => {
    await page.goto('/login?mkt_variant=motion');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    const cookies = await context.cookies();
    const variantCookie = cookies.find(cookie => cookie.name === COOKIE_NAME);

    expect(variantCookie?.value).toBe('motion');
  });
});
