# Real Backend Smoke Suite

This suite runs Playwright against the real backend (no API route mocks).

## Prerequisites

- Start backend API separately (default expected origin: `http://127.0.0.1:4000`).
- Install web dependencies in `web-saas` (`npm install`).

## Run

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/web-saas
npm run test:e2e:real
```

## Optional environment overrides

- `E2E_REAL_API_ORIGIN`: backend origin used by Next rewrite proxy (default `http://127.0.0.1:4000`).
- `PLAYWRIGHT_REAL_PORT`: Next dev server port for this suite (default `3020`).
- `PLAYWRIGHT_REAL_BASE_URL`: explicit base URL if needed.
- `E2E_REAL_SKIP_WEB_SERVER=1`: skip booting Next web server from Playwright config.
