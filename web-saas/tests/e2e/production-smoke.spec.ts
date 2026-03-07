import { expect, test, type Page } from "@playwright/test";

import {
  bootstrapSession,
  mockAppConfig,
  mockJsonSuccess,
  mockUsageSummary,
} from "./helpers/mockApi";
import type { LearnerDashboardView, LearnerProgressView } from "@/lib/types";

/**
 * Production smoke tests — lightweight assertions that every critical page
 * renders without error after deployment.  These are designed to run fast
 * (no complex multi-step flows) and catch regressions in routing, SSR, and
 * basic component rendering.
 */

const nowIso = "2026-02-22T12:00:00.000Z";

const learnerDashboardView: LearnerDashboardView = {
  generatedAt: nowIso,
  plan: "premium",
  kpis: {
    averageBand: 6.5,
    currentStreak: 4,
    testsCompleted: 12,
    nextGoalBand: 7,
  },
  quickPractice: [
    {
      module: "speaking",
      title: "Speaking Simulation",
      description: "AI-powered interview simulation covering Part 1, 2, and 3.",
      href: "/app/speaking",
    },
    {
      module: "writing",
      title: "Writing Task 1 & 2",
      description: "Get instant AI grading and feedback on your essays.",
      href: "/app/writing",
    },
    {
      module: "reading",
      title: "Reading Comprehension",
      description: "Practice with academic texts and question types.",
      href: "/app/reading",
    },
    {
      module: "listening",
      title: "Listening Practice",
      description: "Improve your listening skills with varied accents.",
      href: "/app/listening",
    },
  ],
  resume: {
    type: "practice",
    sessionId: "practice-1",
    title: "Resume Practice",
    subtitle: "Part 3 • Intermediate",
    progressPercent: 42,
    href: "/app/speaking",
  },
  recommended: [
    {
      topicId: "topic-1",
      slug: "social-influence",
      title: "Social Media Influence",
      part: 3,
      difficulty: "intermediate",
    },
    {
      topicId: "topic-2",
      slug: "role-models",
      title: "Role Models in Life",
      part: 2,
      difficulty: "intermediate",
    },
    {
      topicId: "topic-3",
      slug: "environment",
      title: "Environmental Changes",
      part: 2,
      difficulty: "advanced",
    },
  ],
  activity: [
    {
      module: "speaking",
      itemId: "practice-1",
      title: "Urbanization & Society",
      subtitle: "Part 3",
      status: "completed",
      score: 6.5,
      durationSeconds: 860,
      createdAt: nowIso,
      href: "/app/speaking/history/practice-1",
    },
    {
      module: "writing",
      itemId: "writing-attempt-1",
      title: "Task 2: Education",
      subtitle: "Essay",
      status: "in_progress",
      score: 0,
      durationSeconds: 0,
      createdAt: nowIso,
      href: "/app/writing/history/writing-attempt-1",
    },
  ],
};

const learnerDashboardViewNoResume: LearnerDashboardView = {
  ...learnerDashboardView,
  resume: null,
};

const learnerProgressView: LearnerProgressView = {
  range: "90d",
  module: "all",
  totals: {
    overallBand: 6.2,
    predictedScore: 6.8,
    testsCompleted: 10,
    studyHours: 24,
  },
  trend: [
    { date: "2026-01-01T00:00:00.000Z", score: 5.2, target: 6.5 },
    { date: "2026-01-10T00:00:00.000Z", score: 5.6, target: 6.5 },
    { date: "2026-01-20T00:00:00.000Z", score: 5.9, target: 6.8 },
    { date: "2026-01-30T00:00:00.000Z", score: 6.2, target: 7.0 },
  ],
  skillBreakdown: {
    speaking: 6.0,
    writing: 5.8,
    reading: 6.5,
    listening: 6.4,
  },
  attempts: [
    {
      module: "speaking",
      itemId: "practice-1",
      title: "Urbanization & Society",
      subtitle: "Part 3 simulation",
      status: "completed",
      score: 6.5,
      durationSeconds: 860,
      createdAt: nowIso,
      href: "/app/speaking/history/practice-1",
    },
  ],
};

const learnerProgressViewWritingWeakest: LearnerProgressView = {
  ...learnerProgressView,
  skillBreakdown: {
    speaking: 6.6,
    writing: 5.4,
    reading: 6.2,
    listening: 6.1,
  },
};

const setupPointsMocks = async (page: Page) => {
  await page.route("**/api/v1/points/summary**", (route) =>
    route.fulfill(
      mockJsonSuccess({
        balance: 2200,
        totalEarned: 3400,
        totalRedeemed: 1200,
        currentTier: { tier: "5%", percentage: 5, pointsRequired: 1000 },
        nextTier: {
          tier: "10%",
          percentage: 10,
          pointsRequired: 2500,
          pointsNeeded: 300,
        },
        canRedeem: true,
        activeDiscounts: [],
      }),
    ),
  );
  await page.route("**/api/v1/points/transactions**", (route) =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: "tx-1",
          userId: "507f1f77bcf86cd799439011",
          type: "practice_completion",
          amount: 10,
          balance: 2200,
          reason: "Practice completion reward",
          createdAt: nowIso,
        },
      ]),
    ),
  );
};

const setupLearnerContext = async (page: Page) => {
  await bootstrapSession(page);
  await mockAppConfig(page);
  await mockUsageSummary(page);
  await page.route("**/api/v1/app/dashboard-view**", (route) =>
    route.fulfill(mockJsonSuccess(learnerDashboardView)),
  );
  await page.route("**/api/v1/app/progress-view**", (route) =>
    route.fulfill(mockJsonSuccess(learnerProgressView)),
  );
  await setupPointsMocks(page);
};

const setupLearnerContextWithOverrides = async (
  page: Page,
  options: {
    dashboardView?: typeof learnerDashboardView;
    progressView?: typeof learnerProgressView;
    progressStatus?: number;
  } = {},
) => {
  await bootstrapSession(page);
  await mockAppConfig(page);
  await mockUsageSummary(page);
  await page.route("**/api/v1/app/dashboard-view", (route) =>
    route.fulfill(mockJsonSuccess(options.dashboardView ?? learnerDashboardView)),
  );
  await page.route("**/api/v1/app/progress-view**", (route) => {
    if (options.progressStatus && options.progressStatus >= 400) {
      return route.fulfill({
        status: options.progressStatus,
        contentType: "application/json",
        body: JSON.stringify({
          status: options.progressStatus,
          success: false,
          message: "Progress view unavailable",
          timestamp: new Date().toISOString(),
        }),
      });
    }

    return route.fulfill(mockJsonSuccess(options.progressView ?? learnerProgressView));
  });
  await setupPointsMocks(page);
};

const mockEmptyArray = (page: Page, pattern: string) =>
  page.route(pattern, (route) => route.fulfill(mockJsonSuccess([])));

// ── Marketing pages ─────────────────────────────────────────────────────────

test.describe("Marketing smoke", () => {
  test("home page renders hero and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /start free test/i }),
    ).toBeVisible();
  });

  test("marketing login nav resolves to the sign-in form", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByText("Loading sign-in...")).toHaveCount(0);
  });

  test("marketing register nav resolves to the registration form", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free/i }).first().click();

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: "Create Your Account" })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
  });

  test("pricing page renders plan cards", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test("guarantee page renders", async ({ page }) => {
    await page.goto("/guarantee");
    await expect(page.getByText(/band score/i).first()).toBeVisible();
  });

  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("register page renders form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("forgot-password page renders form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send|reset/i }),
    ).toBeVisible();
  });

  test("verify-email page renders verifying state", async ({ page }) => {
    await page.goto("/verify-email");
    // No token → should show invalid/expired state
    await expect(
      page.getByText(/invalid|expired|verification/i).first(),
    ).toBeVisible();
  });

  test("404 page renders for unknown route", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});

// ── Learner app pages ───────────────────────────────────────────────────────

test.describe("Learner app smoke", () => {
  test("dashboard prioritizes resuming an active session", async ({ page }) => {
    await setupLearnerContextWithOverrides(page);

    await page.goto("/app/dashboard");
    await expect(page.getByText("Resume your current session")).toBeVisible();
    await expect(page.getByRole("link", { name: "Resume now" })).toBeVisible();
    await expect(page.getByText("Weakest skill focus")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start New Test" })).toHaveCount(0);
  });

  test("dashboard falls back to the weakest skill when no session is active", async ({ page }) => {
    await setupLearnerContextWithOverrides(page, {
      dashboardView: learnerDashboardViewNoResume,
      progressView: learnerProgressViewWritingWeakest,
    });

    await page.goto("/app/dashboard");
    await expect(page.getByText("Focus on your weakest skill")).toBeVisible();
    await expect(page.getByRole("link", { name: "Practice Writing" })).toBeVisible();
    await expect(page.getByText("Suggested speaking prompts")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start New Test" })).toHaveCount(0);
  });

  test("dashboard keeps a clear fallback action when progress data is unavailable", async ({ page }) => {
    await setupLearnerContextWithOverrides(page, {
      dashboardView: learnerDashboardViewNoResume,
      progressStatus: 500,
    });

    await page.goto("/app/dashboard");
    await expect(page.getByText("Pick up your next practice session")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Start Speaking/ }).first(),
    ).toBeVisible();
    await expect(page.getByText("Dashboard Unavailable")).toHaveCount(0);
  });

  test("achievements page renders", async ({ page }) => {
    await setupLearnerContext(page);
    await mockEmptyArray(page, "**/api/v1/achievements/my**");
    await mockEmptyArray(page, "**/api/v1/achievements**");

    await page.goto("/app/achievements");
    await expect(page.getByText(/achievement/i).first()).toBeVisible();
  });

  test("leaderboard page renders", async ({ page }) => {
    await setupLearnerContext(page);

    await page.route("**/api/v1/leaderboard**", (route) =>
      route.fulfill(
        mockJsonSuccess([
          {
            rank: 1,
            userId: "507f1f77bcf86cd799439011",
            username: "Playwright Learner",
            score: 6.7,
            totalSessions: 20,
            achievements: 4,
            streak: 6,
            isCurrentUser: true,
          },
        ]),
      ),
    );
    await page.route("**/api/v1/leaderboard/friends**", (route) =>
      route.fulfill(mockJsonSuccess([])),
    );
    await page.route("**/api/v1/leaderboard/position**", (route) =>
      route.fulfill(
        mockJsonSuccess({
          rank: 1,
          score: 6.7,
          totalUsers: 124,
          percentile: 15.2,
        }),
      ),
    );

    await page.goto("/app/leaderboard");
    await expect(page.getByText(/leaderboard/i).first()).toBeVisible();
  });

  test("rewards page renders", async ({ page }) => {
    await setupLearnerContext(page);

    await page.goto("/app/rewards");
    await expect(page.getByText(/reward|point/i).first()).toBeVisible();
  });

  test("study plan page renders", async ({ page }) => {
    await setupLearnerContext(page);

    await page.goto("/app/study-plan");
    await expect(page.getByText(/study plan/i).first()).toBeVisible();
  });

  test("full exam page renders learner guidance", async ({ page }) => {
    await setupLearnerContext(page);

    await page.goto("/app/tests");
    await expect(page.getByRole("heading", { name: "Full Exam Simulation" })).toBeVisible();
    await expect(
      page.getByText(
        "Move through each section with clear timing, saved progress, and an easy resume path.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Guided section orchestration with resume support and no manual IDs.",
      ),
    ).toHaveCount(0);
  });
});
