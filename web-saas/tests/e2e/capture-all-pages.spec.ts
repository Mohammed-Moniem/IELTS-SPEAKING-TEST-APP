import fs from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

const screenshotDir = path.resolve(process.cwd(), 'output/playwright/screenshots/all-pages');
const sessionStorageKey = 'spokio.web.session.v1';

const nowIso = '2026-02-22T12:00:00.000Z';

const usageSummary = {
  plan: 'pro',
  practiceCount: 4,
  testCount: 2,
  writingCount: 5,
  readingCount: 4,
  listeningCount: 4,
  aiRequestCount: 24,
  aiTokenCount: 78000,
  aiEstimatedCostUsd: 1.42,
  practiceLimit: 100,
  testLimit: 30,
  writingLimit: 80,
  readingLimit: 80,
  listeningLimit: 80,
  lastReset: nowIso
};

const featureFlags = {
  writing_module: { enabled: true, rolloutPercentage: 100 },
  reading_module: { enabled: true, rolloutPercentage: 100 },
  listening_module: { enabled: true, rolloutPercentage: 100 },
  full_exam_module: { enabled: true, rolloutPercentage: 100 },
  admin_suite: { enabled: true, rolloutPercentage: 100 },
  partner_program: { enabled: true, rolloutPercentage: 100 }
};

const writingSubmission = {
  _id: 'writing-attempt-1',
  taskId: 'writing-task-1',
  overallBand: 7,
  breakdown: {
    taskResponse: 7,
    coherenceCohesion: 7,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 6.5
  },
  feedback: {
    summary: 'Clear argument progression with balanced examples.',
    inlineSuggestions: ['Add one more concrete example in paragraph two.'],
    strengths: ['Strong structure'],
    improvements: ['Expand supporting evidence']
  },
  createdAt: nowIso
};

const readingAttempt = {
  _id: 'reading-attempt-1',
  status: 'completed',
  normalizedBand: 6.5,
  score: 7,
  totalQuestions: 10,
  feedback: { summary: 'Good scanning, improve inference precision.' },
  answers: [
    { questionId: 'r-q1', answer: 'A', isCorrect: true },
    { questionId: 'r-q2', answer: 'B', isCorrect: false }
  ],
  createdAt: nowIso
};

const listeningAttempt = {
  _id: 'listening-attempt-1',
  status: 'completed',
  normalizedBand: 7,
  score: 8,
  totalQuestions: 10,
  feedback: { summary: 'Strong comprehension and note capture.' },
  answers: [
    { questionId: 'l-q1', answer: 'Library', isCorrect: true },
    { questionId: 'l-q2', answer: 'Cafeteria', isCorrect: true }
  ],
  createdAt: nowIso
};

const fullExamSession = {
  _id: 'exam-1',
  track: 'academic',
  status: 'in_progress',
  sections: [
    { module: 'speaking', status: 'completed', attemptId: 'simulation-1', score: 6.5, submittedAt: nowIso },
    { module: 'writing', status: 'in_progress', attemptId: 'writing-attempt-1' },
    { module: 'reading', status: 'pending' },
    { module: 'listening', status: 'pending' }
  ],
  startedAt: nowIso
};

const interruptedExamRuntime = {
  examId: 'exam-1',
  status: 'in_progress',
  currentModule: 'writing',
  currentQuestionIndex: 2,
  remainingSecondsByModule: {
    writing: 1800,
    reading: 3600,
    listening: 1800,
    speaking: 600
  },
  interruptedAt: nowIso,
  lastHeartbeatAt: nowIso,
  resumeToken: 'resume-token-1',
  sections: fullExamSession.sections
};

const partnerList = {
  total: 1,
  partners: [
    {
      _id: 'partner-1',
      displayName: 'Alpha Institute',
      partnerType: 'institute',
      status: 'active',
      ownerUserId: '507f1f77bcf86cd799439099',
      contactEmail: 'partner@example.com',
      defaultCommissionRate: 12,
      createdAt: nowIso
    }
  ]
};

const learnerDashboardView = {
  generatedAt: nowIso,
  plan: 'pro',
  kpis: {
    averageBand: 6.5,
    currentStreak: 4,
    testsCompleted: 12,
    nextGoalBand: 7
  },
  quickPractice: [
    {
      module: 'speaking',
      title: 'Speaking Simulation',
      description: 'AI-powered interview simulation covering Part 1, 2, and 3.',
      href: '/app/speaking'
    },
    {
      module: 'writing',
      title: 'Writing Task 1 & 2',
      description: 'Get instant AI grading and feedback on your essays.',
      href: '/app/writing'
    },
    {
      module: 'reading',
      title: 'Reading Comprehension',
      description: 'Practice with academic texts and question types.',
      href: '/app/reading'
    },
    {
      module: 'listening',
      title: 'Listening Practice',
      description: 'Improve your listening skills with varied accents.',
      href: '/app/listening'
    }
  ],
  resume: {
    type: 'practice',
    sessionId: 'practice-1',
    title: 'Resume Practice',
    subtitle: 'Part 3 • Intermediate',
    progressPercent: 42,
    href: '/app/speaking'
  },
  recommended: [
    { topicId: 'topic-1', slug: 'social-influence', title: 'Social Media Influence', part: 3, difficulty: 'intermediate' },
    { topicId: 'topic-2', slug: 'role-models', title: 'Role Models in Life', part: 2, difficulty: 'intermediate' },
    { topicId: 'topic-3', slug: 'environment', title: 'Environmental Changes', part: 2, difficulty: 'advanced' }
  ],
  activity: [
    {
      module: 'speaking',
      itemId: 'practice-1',
      title: 'Urbanization & Society',
      subtitle: 'Part 3',
      status: 'completed',
      score: 6.5,
      durationSeconds: 860,
      createdAt: nowIso,
      href: '/app/speaking/history/practice-1'
    },
    {
      module: 'writing',
      itemId: 'writing-attempt-1',
      title: 'Task 2: Education',
      subtitle: 'Essay',
      status: 'in_progress',
      score: 0,
      durationSeconds: 0,
      createdAt: nowIso,
      href: '/app/writing/history/writing-attempt-1'
    }
  ]
};

const learnerProgressView = {
  range: '30d',
  module: 'all',
  totals: {
    overallBand: 6.5,
    predictedScore: 7.0,
    testsCompleted: 24,
    studyHours: 32
  },
  trend: [
    { date: '2026-01-01T00:00:00.000Z', score: 4.6, target: 6.5 },
    { date: '2026-01-08T00:00:00.000Z', score: 5.8, target: 6.5 },
    { date: '2026-01-15T00:00:00.000Z', score: 6.4, target: 6.8 },
    { date: '2026-01-22T00:00:00.000Z', score: 6.8, target: 7.0 },
    { date: '2026-01-30T00:00:00.000Z', score: 7.1, target: 7.0 }
  ],
  skillBreakdown: {
    speaking: 6.5,
    writing: 6.0,
    reading: 7.5,
    listening: 8.0
  },
  attempts: [
    {
      module: 'speaking',
      itemId: 'practice-1',
      title: 'Urbanization & Society',
      subtitle: 'Part 3 simulation',
      status: 'completed',
      score: 6.5,
      durationSeconds: 860,
      createdAt: nowIso,
      href: '/app/speaking/history/practice-1'
    },
    {
      module: 'reading',
      itemId: 'reading-attempt-1',
      title: 'Academic Test 4',
      subtitle: 'Full section',
      status: 'completed',
      score: 7.5,
      durationSeconds: 3480,
      createdAt: nowIso,
      href: '/app/reading/history/reading-attempt-1'
    }
  ]
};

const adminOverviewView = {
  window: '1h',
  kpis: {
    activeUsers: 12458,
    estimatedRevenueUsd: 45230,
    aiCostUsd: 2840,
    platformHealthPercent: 99.98
  },
  latencySeries: [
    { label: '10:00', value: 380 },
    { label: '10:05', value: 510 },
    { label: '10:10', value: 460 },
    { label: '10:15', value: 620 },
    { label: '10:20', value: 700 },
    { label: '10:25', value: 630 },
    { label: '10:30', value: 780 },
    { label: '10:35', value: 690 },
    { label: '10:40', value: 520 },
    { label: '10:45', value: 480 },
    { label: '10:50', value: 610 },
    { label: '10:55', value: 760 },
    { label: '11:00', value: 850 }
  ],
  featureFlagSummary: [
    { key: 'new_speaking_engine', enabled: false, rolloutPercentage: 100 },
    { key: 'dark_mode', enabled: true, rolloutPercentage: 100 },
    { key: 'writing_auto_grade', enabled: true, rolloutPercentage: 100 },
    { key: 'maintenance_mode', enabled: false, rolloutPercentage: 100 }
  ],
  alerts: [
    { id: 'alert-1', action: 'Payment Gateway Timeout', targetType: 'stripe', createdAt: nowIso },
    { id: 'alert-2', action: 'High latency - speaking module', targetType: 'api', createdAt: nowIso },
    { id: 'alert-3', action: 'New feature flag created', targetType: 'feature_flag', createdAt: nowIso }
  ],
  deployments: [
    { id: 'dep-1', name: 'Production', status: 'success', createdAt: nowIso },
    { id: 'dep-2', name: 'Staging', status: 'building', createdAt: nowIso }
  ]
};

const adminAnalyticsView = {
  range: '30d',
  kpis: {
    totalRevenueUsd: 24592,
    activeUsersDaily: 1842,
    avgTokenCostUsd: 0.042,
    grossMarginPercent: 68.4
  },
  trafficSeries: [
    { date: '2026-02-01T00:00:00.000Z', activeUsers: 650, submissions: 340 },
    { date: '2026-02-05T00:00:00.000Z', activeUsers: 820, submissions: 520 },
    { date: '2026-02-10T00:00:00.000Z', activeUsers: 780, submissions: 680 },
    { date: '2026-02-15T00:00:00.000Z', activeUsers: 1180, submissions: 760 },
    { date: '2026-02-20T00:00:00.000Z', activeUsers: 1420, submissions: 860 },
    { date: '2026-02-25T00:00:00.000Z', activeUsers: 1540, submissions: 1040 },
    { date: '2026-02-28T00:00:00.000Z', activeUsers: 1480, submissions: 1120 }
  ],
  aiExpenditure: {
    totalCostUsd: 4200,
    totalRequests: 932,
    byModule: [
      { module: 'Speaking (STT/TTS)', costUsd: 2730, requests: 522 },
      { module: 'Writing (LLM)', costUsd: 1470, requests: 410 }
    ]
  },
  partnerPerformance: [
    {
      partnerId: 'partner-1',
      partnerName: 'English Lab',
      touches: 1240,
      conversions: 186,
      conversionRatePercent: 15.0,
      revenueUsd: 37500,
      commissionUsd: 4500
    }
  ],
  apiHealth: [
    { module: 'OpenAI (GPT-4)', total: 900, successRatePercent: 99.9, blockedCount: 0, errorCount: 1 },
    { module: 'Deepgram (STT)', total: 430, successRatePercent: 98.5, blockedCount: 0, errorCount: 6 },
    { module: 'ElevenLabs (TTS)', total: 310, successRatePercent: 94.2, blockedCount: 4, errorCount: 14 }
  ],
  funnel: [
    { key: 'visit', label: 'Visit', count: 4200, conversionFromPreviousPercent: 100 },
    { key: 'register', label: 'Register', count: 980, conversionFromPreviousPercent: 23.33 },
    { key: 'first_practice', label: 'First Practice', count: 740, conversionFromPreviousPercent: 75.51 },
    { key: 'first_paid', label: 'First Paid', count: 186, conversionFromPreviousPercent: 25.14 },
    { key: 'retained_30d', label: '30-Day Retention', count: 122, conversionFromPreviousPercent: 65.59 }
  ],
  cohortSlices: {
    plan: { free: 580, premium: 220, pro: 150, team: 30 },
    modulePreference: { speaking: 310, writing: 260, reading: 220, listening: 190 },
    acquisitionChannel: { direct: 700, partner_register: 180, partner_checkout: 70, partner_manual: 30 }
  }
};

const payoutOperationsView = {
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
      conversionCount: 28,
      contactEmail: 'ops@alphastream.io'
    }
  ],
  total: 2,
  limit: 50,
  offset: 0
};

const jsonSuccess = (data: unknown, status = 200, message?: string) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    status,
    success: true,
    ...(message ? { message } : {}),
    data,
    timestamp: nowIso
  })
});

const installSession = async (page: Page) => {
  await page.addInitScript(
    payload => {
      window.localStorage.setItem(payload.key, JSON.stringify(payload.value));
    },
    {
      key: sessionStorageKey,
      value: {
        accessToken: 'playwright-access-token',
        refreshToken: 'playwright-refresh-token',
        user: {
          _id: '507f1f77bcf86cd799439011',
          email: 'admin@example.com',
          firstName: 'Playwright',
          lastName: 'Admin',
          subscriptionPlan: 'pro',
          adminRoles: ['superadmin']
        }
      }
    }
  );
};

const installApiMocks = async (page: Page) => {
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname.replace(/^\/api\/v1/, '');

    if (pathname === '/app/config' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          roles: ['superadmin'],
          subscriptionPlan: 'pro',
          usageSummary,
          enabledFeatureFlags: Object.keys(featureFlags).filter(key => featureFlags[key as keyof typeof featureFlags].enabled),
          featureFlags,
          partnerPortal: {
            isPartner: true,
            status: 'active',
            partnerType: 'institute'
          }
        })
      );
    }

    if (pathname === '/usage/summary' && method === 'GET') {
      return route.fulfill(jsonSuccess(usageSummary));
    }

    if (pathname === '/app/dashboard-view' && method === 'GET') {
      return route.fulfill(jsonSuccess(learnerDashboardView));
    }

    if (pathname === '/app/progress-view' && method === 'GET') {
      return route.fulfill(jsonSuccess(learnerProgressView));
    }

    if (pathname === '/notifications/preferences' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          dailyReminderEnabled: true,
          dailyReminderHour: 19,
          dailyReminderMinute: 0,
          achievementsEnabled: true,
          streakRemindersEnabled: true,
          inactivityRemindersEnabled: true,
          feedbackNotificationsEnabled: true,
          directMessagesEnabled: true,
          groupMessagesEnabled: true,
          friendRequestsEnabled: true,
          friendAcceptancesEnabled: true,
          systemAnnouncementsEnabled: true,
          offersEnabled: true,
          partnerOffersEnabled: true
        })
      );
    }

    if (pathname === '/topics/practice' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          topics: [
            {
              slug: 'memorable-trip',
              title: 'Memorable Trip',
              description: 'Describe a memorable trip you took.',
              part: 2,
              difficulty: 'medium'
            },
            {
              slug: 'favorite-book',
              title: 'Favorite Book',
              description: 'Talk about a book that influenced you.',
              part: 2,
              difficulty: 'easy'
            }
          ],
          total: 2,
          hasMore: false,
          limit: 9,
          offset: 0
        })
      );
    }

    if (pathname === '/practice/sessions' && method === 'GET') {
      return route.fulfill(
        jsonSuccess([
          {
            _id: 'practice-1',
            topicId: 'memorable-trip',
            topicTitle: 'Memorable Trip',
            question: 'Describe a memorable trip you took.',
            status: 'completed',
            feedback: {
              overallBand: 6.5,
              summary: 'Good structure and coherent delivery.',
              improvements: ['Expand lexical range in follow-up points']
            },
            createdAt: nowIso
          }
        ])
      );
    }

    if (/^\/practice\/sessions\/[^/]+$/.test(pathname) && method === 'GET') {
      const sessionId = pathname.split('/').pop() || 'practice-1';
      return route.fulfill(
        jsonSuccess({
          _id: sessionId,
          topicId: 'memorable-trip',
          topicTitle: 'Memorable Trip',
          question: 'Describe a memorable trip you took.',
          status: 'completed',
          userResponse:
            'I visited Istanbul with my family last spring. The cultural contrast and architecture were unforgettable.',
          feedback: {
            overallBand: 6.5,
            summary: 'Clear delivery with good coherence. Improve lexical precision in follow-up explanations.',
            strengths: ['Good idea flow', 'Natural pacing'],
            improvements: ['Use more varied connectors', 'Expand vocabulary range'],
            bandBreakdown: {
              pronunciation: 6.5,
              fluency: 6.5,
              lexicalResource: 6.0,
              grammaticalRange: 6.5
            }
          },
          completedAt: nowIso,
          createdAt: nowIso
        })
      );
    }

    if (pathname === '/test-simulations' && method === 'GET') {
      return route.fulfill(
        jsonSuccess([
          {
            _id: 'simulation-1',
            simulationId: 'simulation-1',
            status: 'completed',
            parts: [
              { part: 1, question: 'Tell me about your hometown.', response: 'It is coastal and vibrant.' },
              { part: 2, question: 'Describe a memorable trip.', response: 'I travelled with family.' },
              { part: 3, question: 'Why do people travel?', response: 'For learning and perspective.' }
            ],
            overallBand: 6.5,
            createdAt: nowIso
          }
        ])
      );
    }

    if (pathname === '/exams/full/start' && method === 'POST') {
      return route.fulfill(jsonSuccess(fullExamSession));
    }

    if (/^\/exams\/full\/[^/]+\/runtime$/.test(pathname) && method === 'GET') {
      return route.fulfill(jsonSuccess(interruptedExamRuntime));
    }

    if (/^\/exams\/full\/[^/]+\/results$/.test(pathname) && method === 'GET') {
      return route.fulfill(jsonSuccess(fullExamSession));
    }

    if (/^\/exams\/full\/[^/]+\/pause$/.test(pathname) && method === 'POST') {
      return route.fulfill(jsonSuccess(fullExamSession));
    }

    if (/^\/exams\/full\/[^/]+\/resume$/.test(pathname) && method === 'POST') {
      return route.fulfill(jsonSuccess(fullExamSession));
    }

    if (pathname === '/writing/history' && method === 'GET') {
      return route.fulfill(jsonSuccess([writingSubmission]));
    }

    if (/^\/writing\/submissions\/[^/]+$/.test(pathname) && method === 'GET') {
      const submissionId = pathname.split('/').pop();
      return route.fulfill(jsonSuccess({ ...writingSubmission, _id: submissionId }));
    }

    if (pathname === '/reading/history' && method === 'GET') {
      return route.fulfill(jsonSuccess([readingAttempt]));
    }

    if (/^\/reading\/tests\/[^/]+$/.test(pathname) && method === 'GET') {
      const attemptId = pathname.split('/').pop();
      return route.fulfill(jsonSuccess({ ...readingAttempt, _id: attemptId }));
    }

    if (pathname === '/listening/history' && method === 'GET') {
      return route.fulfill(jsonSuccess([listeningAttempt]));
    }

    if (/^\/listening\/tests\/[^/]+$/.test(pathname) && method === 'GET') {
      const attemptId = pathname.split('/').pop();
      return route.fulfill(jsonSuccess({ ...listeningAttempt, _id: attemptId }));
    }

    if (pathname === '/subscription/plans' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          plans: [
            {
              tier: 'free',
              name: 'Free',
              headline: 'Start IELTS prep',
              description: 'Core access for trial usage.',
              audience: 'individual',
              features: ['Limited practice', 'Basic progress'],
              pricing: { currency: 'USD', monthly: { amount: 0 } },
              limits: {
                practiceSessionsPerMonth: 10,
                simulationSessionsPerMonth: 2,
                writingSubmissionsPerMonth: 4,
                readingAttemptsPerMonth: 4,
                listeningAttemptsPerMonth: 4
              }
            },
            {
              tier: 'premium',
              name: 'Premium',
              headline: 'Focused score growth',
              description: 'Best for regular test prep.',
              audience: 'individual',
              recommended: true,
              features: ['Expanded module limits', 'Priority feedback'],
              pricing: {
                currency: 'USD',
                monthly: { amount: 29, priceId: 'price_premium_monthly_test' },
                annual: { amount: 290, priceId: 'price_premium_annual_test', savingsPercent: 17 }
              },
              limits: {
                practiceSessionsPerMonth: 80,
                simulationSessionsPerMonth: 20,
                writingSubmissionsPerMonth: 60,
                readingAttemptsPerMonth: 60,
                listeningAttemptsPerMonth: 60
              }
            },
            {
              tier: 'pro',
              name: 'Pro',
              headline: 'High-intensity prep',
              description: 'For daily practice and heavier AI usage.',
              audience: 'individual',
              features: ['Higher limits', 'Advanced analytics'],
              pricing: {
                currency: 'USD',
                monthly: { amount: 59, priceId: 'price_pro_monthly_test' },
                annual: { amount: 590, priceId: 'price_pro_annual_test', savingsPercent: 17 }
              },
              limits: {
                practiceSessionsPerMonth: 200,
                simulationSessionsPerMonth: 80,
                writingSubmissionsPerMonth: 120,
                readingAttemptsPerMonth: 120,
                listeningAttemptsPerMonth: 120
              }
            }
          ]
        })
      );
    }

    if (pathname === '/subscription/current' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          planType: 'pro',
          status: 'active',
          metadata: {
            label: 'Pro',
            headline: 'High-intensity prep',
            description: 'Daily practice and advanced analytics',
            features: ['High module limits']
          }
        })
      );
    }

    if (pathname === '/subscription/config' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          enabled: true,
          mode: 'test',
          publishableKey: 'pk_test_123',
          portalEnabled: true,
          prices: {
            premium: 'price_premium_monthly_test',
            pro: 'price_pro_monthly_test',
            team: 'price_team_monthly_test'
          },
          priceMatrix: {
            premium: { monthly: 'price_premium_monthly_test', annual: 'price_premium_annual_test' },
            pro: { monthly: 'price_pro_monthly_test', annual: 'price_pro_annual_test' },
            team: { monthly: 'price_team_monthly_test', annual: 'price_team_annual_test' }
          }
        })
      );
    }

    if (pathname === '/partners/me' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          enabled: true,
          isPartner: true,
          status: 'active',
          partnerType: 'institute',
          partner: {
            _id: 'partner-1',
            displayName: 'Alpha Institute',
            status: 'active',
            partnerType: 'institute'
          }
        })
      );
    }

    if (pathname === '/partners/dashboard' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          partner: {
            id: 'partner-1',
            partnerType: 'institute',
            displayName: 'Alpha Institute',
            status: 'active',
            defaultCommissionRate: 12
          },
          lifetime: {
            conversions: 142,
            revenueUsd: 19240,
            commissionUsd: 2308.8,
            bonusUsd: 320,
            totalEarningsUsd: 2628.8
          },
          thisMonth: {
            periodStart: '2026-02-01T00:00:00.000Z',
            periodEnd: '2026-02-28T23:59:59.000Z',
            conversions: 22,
            revenueUsd: 2940,
            commissionUsd: 352.8
          },
          payouts: {
            unpaidUsd: 481.2,
            paidItems: 12,
            pendingItems: 4
          },
          activeCodes: [
            {
              id: 'code-1',
              code: 'ALPHA20',
              attributionOnly: false,
              commissionRateOverride: 14
            }
          ]
        })
      );
    }

    if (pathname === '/admin/analytics' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          users: 1240,
          moduleActivity: {
            writingSubmissions: 842,
            readingAttempts: 913,
            listeningAttempts: 877
          },
          activePaidSubscriptions: 426,
          featureFlags: [
            { key: 'writing_module', enabled: true },
            { key: 'reading_module', enabled: true },
            { key: 'listening_module', enabled: true },
            { key: 'full_exam_module', enabled: true }
          ]
        })
      );
    }

    if (pathname === '/admin/overview-view' && method === 'GET') {
      return route.fulfill(jsonSuccess(adminOverviewView));
    }

    if (pathname === '/admin/analytics-view' && method === 'GET') {
      return route.fulfill(jsonSuccess(adminAnalyticsView));
    }

    if (pathname === '/admin/ai-usage' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          aggregate: [
            { _id: 'writing', requestCount: 410, costUsd: 61.44, tokenCount: 2420000, cacheHits: 86 },
            { _id: 'speaking', requestCount: 522, costUsd: 72.2, tokenCount: 2860000, cacheHits: 101 }
          ],
          recentLogs: [
            {
              _id: 'ai-log-1',
              module: 'writing',
              operation: 'score_submission',
              model: 'gpt-5-mini',
              inputTokens: 1400,
              outputTokens: 420,
              estimatedCostUsd: 0.18,
              cacheHit: false,
              status: 'success',
              createdAt: nowIso
            },
            {
              _id: 'ai-log-2',
              module: 'speaking',
              operation: 'evaluate',
              model: 'gpt-5-mini',
              inputTokens: 1100,
              outputTokens: 360,
              estimatedCostUsd: 0.15,
              cacheHit: true,
              status: 'success',
              createdAt: nowIso
            }
          ]
        })
      );
    }

    if (pathname === '/admin/users' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          total: 2,
          users: [
            {
              _id: 'user-1',
              email: 'admin@example.com',
              firstName: 'Playwright',
              lastName: 'Admin',
              subscriptionPlan: 'pro',
              adminRoles: ['superadmin']
            },
            {
              _id: 'user-2',
              email: 'manager@example.com',
              firstName: 'Content',
              lastName: 'Manager',
              subscriptionPlan: 'premium',
              adminRoles: ['content_manager']
            }
          ]
        })
      );
    }

    if (pathname === '/admin/audit-logs' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          logs: [
            {
              _id: 'audit-1',
              actorUserId: 'user-1',
              action: 'admin.notifications.campaign.created',
              targetType: 'notification_campaign',
              targetId: 'campaign-1',
              createdAt: nowIso
            },
            {
              _id: 'audit-2',
              actorUserId: 'user-1',
              action: 'admin.users.roles.updated',
              targetType: 'user',
              targetId: 'user-2',
              createdAt: nowIso
            }
          ],
          total: 2,
          limit: 50,
          offset: 0
        })
      );
    }

    if (pathname === '/admin/subscriptions' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          total: 2,
          subscriptions: [
            {
              _id: 'sub-1',
              userId: 'user-1',
              planType: 'pro',
              status: 'active',
              expiresAt: '2026-12-31T00:00:00.000Z'
            },
            {
              _id: 'sub-2',
              userId: 'user-2',
              planType: 'premium',
              status: 'active',
              expiresAt: '2026-10-01T00:00:00.000Z'
            }
          ]
        })
      );
    }

    if (pathname === '/admin/feature-flags' && method === 'GET') {
      return route.fulfill(
        jsonSuccess([
          { key: 'writing_module', enabled: true, rolloutPercentage: 100, description: 'Writing rollout' },
          { key: 'reading_module', enabled: true, rolloutPercentage: 100, description: 'Reading rollout' },
          { key: 'listening_module', enabled: true, rolloutPercentage: 100, description: 'Listening rollout' },
          { key: 'full_exam_module', enabled: true, rolloutPercentage: 100, description: 'Full exam rollout' },
          { key: 'admin_suite', enabled: true, rolloutPercentage: 100, description: 'Admin suite rollout' }
        ])
      );
    }

    if (pathname === '/admin/notifications/campaigns' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          total: 2,
          limit: 100,
          offset: 0,
          campaigns: [
            {
              _id: 'campaign-1',
              title: 'Weekly IELTS challenge',
              body: 'Try this week’s speaking challenge.',
              type: 'system',
              status: 'sent',
              createdAt: nowIso,
              updatedAt: nowIso,
              audience: { kind: 'all_users' },
              deliverySummary: { targetedUsers: 1000, attempts: 980, sent: 940, failed: 40, skipped: 0 }
            },
            {
              _id: 'campaign-2',
              title: 'Partner spring offer',
              body: 'Special partner discount this week.',
              type: 'offer',
              status: 'scheduled',
              scheduledAt: '2026-02-25T11:00:00.000Z',
              createdAt: nowIso,
              updatedAt: nowIso,
              audience: { kind: 'partner_owners_and_attributed', partnerIds: ['partner-1'] },
              deliverySummary: { targetedUsers: 280, attempts: 0, sent: 0, failed: 0, skipped: 0 }
            }
          ]
        })
      );
    }

    if (pathname === '/admin/notifications/campaigns/preflight' && method === 'POST') {
      return route.fulfill(
        jsonSuccess({
          audienceEstimate: {
            targetedUsers: 320,
            targetedPartners: 1
          },
          safety: {
            frequencyCapOk: true,
            linkValidationOk: true,
            scheduleReady: true,
            warnings: []
          },
          diagnostics: {
            linksDetected: ['https://spokio.app/pricing'],
            invalidLinks: [],
            usersWithRecentMessages: 12
          }
        })
      );
    }

    if (/^\/admin\/notifications\/campaigns\/[^/]+$/.test(pathname) && method === 'GET') {
      const campaignId = pathname.split('/').pop() || 'campaign-1';
      return route.fulfill(
        jsonSuccess({
          campaign: {
            _id: campaignId,
            title: campaignId === 'campaign-2' ? 'Partner spring offer' : 'Weekly IELTS challenge',
            body: 'Campaign detail body',
            type: campaignId === 'campaign-2' ? 'offer' : 'system',
            status: campaignId === 'campaign-2' ? 'scheduled' : 'sent',
            createdAt: nowIso,
            updatedAt: nowIso,
            audience: campaignId === 'campaign-2' ? { kind: 'partner_owners_and_attributed' } : { kind: 'all_users' },
            deliverySummary: { targetedUsers: 320, attempts: 300, sent: 288, failed: 12, skipped: 0 }
          },
          deliveries: [
            {
              _id: 'delivery-1',
              campaignId,
              userId: 'user-1',
              channel: 'expo',
              provider: 'expo',
              status: 'sent',
              createdAt: nowIso
            },
            {
              _id: 'delivery-2',
              campaignId,
              userId: 'user-2',
              channel: 'fcm_web',
              provider: 'fcm',
              status: 'failed',
              errorCode: 'invalid_token',
              errorMessage: 'Token invalid',
              createdAt: nowIso
            }
          ],
          totalDeliveries: 2,
          breakdown: {
            byStatus: [
              { _id: 'sent', count: 1 },
              { _id: 'failed', count: 1 }
            ],
            byChannel: [
              { _id: 'expo', count: 1 },
              { _id: 'fcm_web', count: 1 }
            ]
          }
        })
      );
    }

    if (pathname === '/admin/partners' && method === 'GET') {
      return route.fulfill(jsonSuccess(partnerList));
    }

    if (pathname === '/admin/partners/payout-operations-view' && method === 'GET') {
      return route.fulfill(jsonSuccess(payoutOperationsView));
    }

    if (/^\/admin\/partners\/[^/]+\/codes$/.test(pathname) && method === 'GET') {
      const partnerId = pathname.split('/')[3];
      return route.fulfill(
        jsonSuccess({
          partnerId,
          total: 1,
          limit: 100,
          offset: 0,
          codes: [
            {
              _id: 'code-1',
              code: 'ALPHA20',
              description: 'Primary partner code',
              isActive: true,
              attributionOnly: false,
              linkedCouponCode: 'SAVE20',
              commissionRateOverride: 14,
              validFrom: nowIso,
              createdAt: nowIso
            }
          ]
        })
      );
    }

    if (/^\/admin\/partners\/[^/]+\/targets$/.test(pathname) && method === 'GET') {
      const partnerId = pathname.split('/')[3];
      return route.fulfill(
        jsonSuccess({
          partnerId,
          total: 1,
          limit: 100,
          offset: 0,
          targets: [
            {
              _id: 'target-1',
              name: 'Monthly Paid Conversions',
              metric: 'paid_conversions',
              period: 'monthly',
              thresholdValue: 20,
              bonusAmountUsd: 150,
              commissionUpliftPercent: 2,
              upliftDurationDays: 30,
              isActive: true,
              startsAt: '2026-02-01T00:00:00.000Z',
              createdAt: nowIso
            }
          ]
        })
      );
    }

    if (pathname === '/admin/partners/payout-batches' && method === 'GET') {
      return route.fulfill(
        jsonSuccess({
          total: 1,
          limit: 100,
          offset: 0,
          batches: [
            {
              _id: 'batch-1',
              periodStart: '2026-02-01T00:00:00.000Z',
              periodEnd: '2026-02-28T23:59:59.000Z',
              status: 'draft',
              partnerCount: 1,
              totals: { commissionUsd: 420, bonusUsd: 80, totalUsd: 500 },
              createdAt: nowIso
            }
          ]
        })
      );
    }

    if (pathname === '/admin/partners/payout-batches/preview' && method === 'POST') {
      return route.fulfill(
        jsonSuccess({
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          partnerCount: 1,
          totals: { commissionUsd: 420, bonusUsd: 80, totalUsd: 500 },
          preflight: {
            processingFeeUsd: 4.5,
            flaggedAccounts: [
              {
                partnerId: 'partner-1',
                partnerName: 'Alpha Institute',
                amountUsd: 500,
                status: 'review_required',
                riskFactors: ['high_referral_velocity']
              }
            ],
            riskSummary: {
              flaggedCount: 1,
              flaggedAmountUsd: 500
            }
          }
        })
      );
    }

    if (pathname === '/admin/partners/payout-batches' && method === 'POST') {
      return route.fulfill(
        jsonSuccess(
          {
            batch: {
              _id: 'batch-1'
            }
          },
          201
        )
      );
    }

    if (/^\/admin\/partners\/payout-batches\/[^/]+$/.test(pathname) && method === 'GET') {
      const batchId = pathname.split('/').pop() || 'batch-1';
      return route.fulfill(
        jsonSuccess({
          batch: {
            _id: batchId,
            periodStart: '2026-02-01T00:00:00.000Z',
            periodEnd: '2026-02-28T23:59:59.000Z',
            status: 'draft',
            partnerCount: 1,
            totals: { commissionUsd: 420, bonusUsd: 80, totalUsd: 500 },
            createdAt: nowIso
          },
          items: [
            {
              _id: 'item-1',
              partnerId: 'partner-1',
              totalUsd: 500,
              commissionUsd: 420,
              bonusUsd: 80,
              status: 'pending',
              partner: {
                _id: 'partner-1',
                displayName: 'Alpha Institute',
                status: 'active'
              }
            }
          ],
          preflight: {
            processingFeeUsd: 4.5,
            flaggedAccounts: [
              {
                partnerId: 'partner-1',
                partnerName: 'Alpha Institute',
                amountUsd: 500,
                status: 'review_required',
                riskFactors: ['high_referral_velocity']
              }
            ],
            riskSummary: {
              flaggedCount: 1,
              flaggedAmountUsd: 500
            }
          }
        })
      );
    }

    if (pathname.startsWith('/admin/content') && method === 'GET') {
      return route.fulfill(
        jsonSuccess([
          {
            _id: 'content-writing-1',
            track: 'academic',
            taskType: 'task2',
            title: 'City Planning Essay',
            prompt: 'Discuss effects of city expansion.',
            minimumWords: 250,
            suggestedTimeMinutes: 40
          }
        ])
      );
    }

    return route.fulfill(jsonSuccess({}));
  });
};

const pages = [
  { path: '/', file: 'marketing-home' },
  { path: '/pricing', file: 'marketing-pricing' },
  { path: '/features', file: 'marketing-features' },
  { path: '/about', file: 'marketing-about' },
  { path: '/contact', file: 'marketing-contact' },
  { path: '/editorial-policy', file: 'marketing-editorial-policy' },
  { path: '/methodology', file: 'marketing-methodology' },
  { path: '/login', file: 'marketing-login' },
  { path: '/register', file: 'marketing-register' },
  { path: '/ielts', file: 'marketing-ielts-list' },
  { path: '/ielts/ielts-speaking-practice-online', file: 'marketing-ielts-guide-speaking-practice-online' },
  { path: '/app/dashboard', file: 'learner-dashboard' },
  { path: '/app/speaking', file: 'learner-speaking' },
  { path: '/app/writing', file: 'learner-writing' },
  { path: '/app/reading', file: 'learner-reading' },
  { path: '/app/listening', file: 'learner-listening' },
  { path: '/app/tests', file: 'learner-tests' },
  { path: '/app/progress', file: 'learner-progress' },
  { path: '/app/billing', file: 'learner-billing' },
  { path: '/app/settings', file: 'learner-settings' },
  { path: '/app/partner', file: 'learner-partner' },
  { path: '/app/speaking/history/practice-1', file: 'learner-speaking-history-detail' },
  { path: '/app/writing/history/writing-attempt-1', file: 'learner-writing-history-detail' },
  { path: '/app/reading/history/reading-attempt-1', file: 'learner-reading-history-detail' },
  { path: '/app/listening/history/listening-attempt-1', file: 'learner-listening-history-detail' },
  { path: '/admin/overview', file: 'admin-overview' },
  { path: '/admin/content', file: 'admin-content' },
  { path: '/admin/users', file: 'admin-users' },
  { path: '/admin/subscriptions', file: 'admin-subscriptions' },
  { path: '/admin/analytics', file: 'admin-analytics' },
  { path: '/admin/ai-cost', file: 'admin-ai-cost' },
  { path: '/admin/flags', file: 'admin-flags' },
  { path: '/admin/notifications', file: 'admin-notifications' },
  { path: '/admin/partners', file: 'admin-partners' }
];

test.describe.configure({ mode: 'serial' });

const gotoStable = async (page: Page, routePath: string) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientNavigationIssue =
        message.includes('NS_BINDING_ABORTED') || message.includes('interrupted by another navigation');

      if (!isTransientNavigationIssue || attempt === maxAttempts) {
        throw error;
      }

      await page.waitForTimeout(250);
    }
  }
};

test('captures screenshots for all web app pages', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  await installSession(page);
  await installApiMocks(page);

  for (const item of pages) {
    await gotoStable(page, item.path);
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(screenshotDir, `${item.file}.png`),
      fullPage: true
    });
  }

  await gotoStable(page, '/admin/flags');
  await page.getByRole('row', { name: /full_exam_module/i }).getByRole('button', { name: 'Toggle' }).click();
  await page.getByRole('heading', { name: 'High-impact confirmation required' }).waitFor();
  await page.screenshot({
    path: path.join(screenshotDir, 'admin-flags-high-impact-confirmation.png'),
    fullPage: true
  });

  await gotoStable(page, '/admin/notifications');
  await page.getByRole('button', { name: 'Run Preflight' }).click();
  await page.getByText('Safety preflight').waitFor();
  await page.screenshot({
    path: path.join(screenshotDir, 'admin-notifications-safety-preflight.png'),
    fullPage: true
  });

  await gotoStable(page, '/admin/partners');
  await page.getByRole('button', { name: 'Process Batch' }).click();
  await page.getByRole('dialog', { name: 'Payout confirmation' }).waitFor();
  await page.screenshot({
    path: path.join(screenshotDir, 'admin-partners-payout-preview.png'),
    fullPage: true
  });

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirm & Execute Payout' }).click();
  await page.getByText('Payout batch created successfully.').waitFor();
  await page.screenshot({
    path: path.join(screenshotDir, 'admin-partners-payout-detail.png'),
    fullPage: true
  });

  await gotoStable(page, '/app/tests');
  const resumeModal = page.locator('.st2-resume-modal').first();
  if (!(await resumeModal.isVisible().catch(() => false))) {
    const startExamButton = page.locator('.st2-start-card').getByRole('button', { name: 'Start Full Exam' });
    if (await startExamButton.isVisible().catch(() => false)) {
      await startExamButton.click();
    }
  }
  await resumeModal.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {
    // Keep screenshot capture resilient when runtime state is already progressed.
  });
  await page.screenshot({
    path: path.join(screenshotDir, 'learner-tests-interruption-state.png'),
    fullPage: true
  });
});
