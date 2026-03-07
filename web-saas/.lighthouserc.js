let chromePath;

try {
  // Use Playwright-managed Chromium for deterministic CI behavior.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('@playwright/test');
  chromePath = chromium.executablePath();
} catch {
  chromePath = undefined;
}

/** @type {import('@lhci/cli/src/types/lighthouserc').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      startServerCommand: 'npm run start -- --hostname 127.0.0.1 --port 3040',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 120000,
      url: [
        'http://127.0.0.1:3040/',
        'http://127.0.0.1:3040/pricing',
        'http://127.0.0.1:3040/features',
        'http://127.0.0.1:3040/blog',
        'http://127.0.0.1:3040/blog/academic-discussion-skills-for-ielts-speaking-part-3',
        'http://127.0.0.1:3040/ielts',
        'http://127.0.0.1:3040/ielts/ielts-speaking-practice-online'
      ],
      settings: {
        preset: 'desktop',
        ...(chromePath ? { chromePath } : {})
      }
    },
    assert: {
      assertions: {
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
