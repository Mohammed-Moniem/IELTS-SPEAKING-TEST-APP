import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_REAL_PORT || 3020);
const baseUrl = process.env.PLAYWRIGHT_REAL_BASE_URL || `http://127.0.0.1:${port}`;
const apiOrigin = process.env.E2E_REAL_API_ORIGIN || 'http://127.0.0.1:4000';
const shouldStartWebServer = process.env.E2E_REAL_SKIP_WEB_SERVER !== '1';

export default defineConfig({
  testDir: './tests/e2e-real',
  timeout: 180 * 1000,
  expect: {
    timeout: 15 * 1000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright-real/report', open: 'never' }]
  ],
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: shouldStartWebServer
    ? {
        command: `API_INTERNAL_BASE_URL=${apiOrigin} NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000
      }
    : undefined
});
