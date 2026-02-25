export type SubscriptionPlan = 'free' | 'premium' | 'pro' | 'team';
export type BillingCycle = 'monthly' | 'annual';

export type AdminRole = 'superadmin' | 'content_manager' | 'support_agent';

export type IELTSModule = 'speaking' | 'writing' | 'reading' | 'listening';

export type IELTSModuleTrack = 'academic' | 'general';

export interface StandardResponse<T> {
  status: number;
  success: boolean;
  message?: string | string[];
  data?: T;
  timestamp: string;
  requestId?: string;
}

export interface AuthUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionPlan: SubscriptionPlan;
  adminRoles?: AdminRole[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface UsageSummary {
  plan: SubscriptionPlan;
  practiceCount: number;
  testCount: number;
  writingCount: number;
  readingCount: number;
  listeningCount: number;
  aiRequestCount: number;
  aiTokenCount: number;
  aiEstimatedCostUsd: number;
  practiceLimit: number;
  testLimit: number;
  writingLimit: number;
  readingLimit: number;
  listeningLimit: number;
  lastReset: string;
}

export interface SubscriptionPlanCatalogEntry {
  tier: SubscriptionPlan;
  name: string;
  headline: string;
  description: string;
  audience: string;
  recommended?: boolean;
  features: string[];
  pricing: {
    currency: string;
    monthly: {
      amount: number;
      priceId?: string;
    };
    annual?: {
      amount: number;
      priceId?: string;
      savingsPercent: number;
    };
  };
  limits: {
    practiceSessionsPerMonth: number;
    simulationSessionsPerMonth: number;
    writingSubmissionsPerMonth: number;
    readingAttemptsPerMonth: number;
    listeningAttemptsPerMonth: number;
  };
}

export interface SubscriptionPlanCatalogResponse {
  plans: SubscriptionPlanCatalogEntry[];
}

export interface StripeConfiguration {
  enabled: boolean;
  mode: 'disabled' | 'test' | 'live' | 'unknown';
  publishableKey?: string;
  portalEnabled: boolean;
  billingPortalReturnUrl?: string;
  prices: {
    premium?: string;
    pro?: string;
    team?: string;
  };
  priceMatrix?: Record<
    Exclude<SubscriptionPlan, 'free'>,
    {
      monthly?: string;
      annual?: string;
    }
  >;
  plans?: Array<{
    tier: SubscriptionPlan;
    name: string;
    price: number;
    currency?: string;
    description?: string;
    features?: string[];
    limits?: {
      practice?: number | null;
      simulation?: number | null;
    };
  }>;
}

export interface FeatureFlag {
  _id?: string;
  key: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
}

export interface AppConfigFeatureFlagState {
  enabled: boolean;
  rolloutPercentage: number;
}

export interface PartnerPortalStatus {
  isPartner: boolean;
  status?: 'pending' | 'active' | 'suspended' | 'rejected' | string;
  partnerType?: 'influencer' | 'institute' | string;
  dashboardUrl?: string;
  registrationUrl?: string;
}

export interface AppConfig {
  roles: AdminRole[] | string[];
  subscriptionPlan: SubscriptionPlan;
  usageSummary: UsageSummary;
  enabledFeatureFlags: string[];
  featureFlags: Record<string, AppConfigFeatureFlagState>;
  partnerPortal?: PartnerPortalStatus;
}

export interface WritingTask {
  taskId: string;
  track: IELTSModuleTrack;
  taskType: 'task1' | 'task2';
  title: string;
  prompt: string;
  instructions: string[];
  suggestedTimeMinutes: number;
  minimumWords: number;
  tags: string[];
}

export interface WritingSubmissionBreakdown {
  taskResponse: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}

export interface WritingSubmissionFeedback {
  summary: string;
  inlineSuggestions: string[];
  strengths: string[];
  improvements: string[];
}

export interface WritingSubmission {
  _id: string;
  taskId?: string;
  track?: IELTSModuleTrack;
  taskType?: 'task1' | 'task2';
  overallBand: number;
  wordCount?: number;
  durationSeconds?: number;
  breakdown: WritingSubmissionBreakdown;
  feedback: WritingSubmissionFeedback;
  createdAt?: string;
}

export interface ObjectiveQuestion {
  questionId: string;
  type: string;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
}

export interface ObjectiveTestPayload {
  testId: string;
  title: string;
  track: IELTSModuleTrack;
  questions: ObjectiveQuestion[];
  passageText?: string;
  transcript?: string;
  audioUrl?: string;
  suggestedTimeMinutes: number;
}

export interface ObjectiveAnswer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
}

export interface ObjectiveAttempt {
  _id: string;
  attemptId?: string;
  normalizedBand?: number;
  score?: number;
  totalQuestions?: number;
  durationSeconds?: number;
  feedback?: {
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    suggestions?: string[];
  };
  status?: string;
  answers?: ObjectiveAnswer[];
  test?: ObjectiveTestPayload;
  testId?: ObjectiveTestPayload | string;
  track?: IELTSModuleTrack;
  createdAt?: string;
}

export interface SpeakingEvaluation {
  overallBand: number;
  spokenSummary: string;
  criteria: Record<string, unknown>;
  corrections: Array<Record<string, unknown>>;
  suggestions: Array<string | { suggestion?: string }>;
}

export interface PracticeTopic {
  _id?: string;
  slug: string;
  title: string;
  description?: string;
  part: number;
  category?: string;
  difficulty?: string;
  isPremium?: boolean;
}

export interface PracticeTopicPage {
  topics: PracticeTopic[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface PracticeSessionStartPayload {
  sessionId: string;
  topic: PracticeTopic;
  question: string;
  timeLimit: number;
  tips: string[];
}

export interface PracticeSessionFeedback {
  overallBand?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  bandBreakdown?: {
    pronunciation?: number;
    fluency?: number;
    lexicalResource?: number;
    grammaticalRange?: number;
  };
}

export interface PracticeSession {
  _id?: string;
  sessionId?: string;
  topicId: string;
  topicTitle?: string;
  question: string;
  part?: number;
  status: 'in_progress' | 'completed';
  userResponse?: string;
  feedback?: PracticeSessionFeedback;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface SpeakingSessionDetail extends PracticeSession {
  _id: string;
  question: string;
  topicTitle?: string;
  userResponse?: string;
  feedback?: PracticeSessionFeedback;
}

export interface PracticeAudioUploadResult {
  session: PracticeSession;
  transcription: {
    text: string;
    confidence?: number;
    duration?: number;
  };
}

export interface SimulationPartDefinition {
  part: number;
  topicId?: string;
  topicTitle?: string;
  question: string;
  timeLimit?: number;
  tips?: string[];
  response?: string;
  timeSpent?: number;
  feedback?: PracticeSessionFeedback;
}

export interface SimulationStartPayload {
  simulationId: string;
  parts: SimulationPartDefinition[];
}

export interface SimulationSession {
  _id?: string;
  simulationId?: string;
  status: 'in_progress' | 'completed';
  parts: SimulationPartDefinition[];
  overallBand?: number;
  overallFeedback?: PracticeSessionFeedback;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface FullExamSection {
  module: IELTSModule;
  status: 'pending' | 'in_progress' | 'completed';
  attemptId?: string;
  score?: number;
  submittedAt?: string;
}

export interface FullExamSession {
  _id: string;
  track: IELTSModuleTrack;
  status: 'in_progress' | 'completed';
  sections: FullExamSection[];
  overallBand?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ExamRuntimeState {
  examId: string;
  status: 'in_progress' | 'completed';
  currentModule?: IELTSModule;
  currentQuestionIndex?: number;
  remainingSecondsByModule?: Partial<Record<IELTSModule, number>>;
  interruptedAt?: string;
  lastHeartbeatAt?: string;
  resumeToken?: string;
  sections: FullExamSection[];
}

export interface AdminPaginationResult<T> {
  total: number;
  limit: number;
  offset: number;
  users?: T[];
  subscriptions?: T[];
}

export interface AIUsageLog {
  _id: string;
  module: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  status: string;
  createdAt: string;
}

export interface AdminAuditLog {
  _id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditLogPage {
  logs: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserRecord {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionPlan: SubscriptionPlan;
  adminRoles?: AdminRole[];
}

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
  achievementsEnabled: boolean;
  streakRemindersEnabled: boolean;
  inactivityRemindersEnabled: boolean;
  feedbackNotificationsEnabled: boolean;
  directMessagesEnabled: boolean;
  groupMessagesEnabled: boolean;
  friendRequestsEnabled: boolean;
  friendAcceptancesEnabled: boolean;
  systemAnnouncementsEnabled: boolean;
  offersEnabled: boolean;
  partnerOffersEnabled: boolean;
}

export type NotificationCampaignType = 'system' | 'offer';
export type NotificationCampaignStatus = 'draft' | 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';
export type NotificationCampaignAudienceKind =
  | 'all_users'
  | 'all_partner_owners'
  | 'partner_owners_by_type'
  | 'partner_owners_by_ids'
  | 'partner_attributed_users'
  | 'partner_owners_and_attributed';

export interface NotificationCampaignAudience {
  kind: NotificationCampaignAudienceKind;
  partnerType?: 'influencer' | 'institute';
  partnerIds?: string[];
}

export interface NotificationCampaignRecord {
  _id: string;
  title: string;
  body: string;
  type: NotificationCampaignType;
  status: NotificationCampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  audience: NotificationCampaignAudience;
  deliverySummary?: {
    targetedUsers: number;
    attempts: number;
    sent: number;
    failed: number;
    skipped: number;
  };
}

export interface NotificationDeliveryRecord {
  _id: string;
  campaignId: string;
  userId: string;
  channel: 'expo' | 'fcm_web';
  provider: 'expo' | 'fcm';
  status: 'sent' | 'failed' | 'skipped';
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface NotificationCampaignListPage {
  campaigns: NotificationCampaignRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationCampaignDetail {
  campaign: NotificationCampaignRecord;
  deliveries: NotificationDeliveryRecord[];
  totalDeliveries: number;
  breakdown: {
    byStatus: Array<{ _id: string; count: number }>;
    byChannel: Array<{ _id: string; count: number }>;
  };
}

export interface CampaignPreflight {
  audienceEstimate: {
    targetedUsers: number;
    targetedPartners?: number;
  };
  safety: {
    frequencyCapOk: boolean;
    linkValidationOk: boolean;
    scheduleReady: boolean;
    warnings: string[];
  };
  diagnostics?: {
    linksDetected: string[];
    invalidLinks: string[];
    usersWithRecentMessages: number;
  };
}

export interface PayoutBatchPreview {
  periodStart: string;
  periodEnd: string;
  partnerCount: number;
  totals: {
    commissionUsd: number;
    bonusUsd: number;
    totalUsd: number;
  };
  preflight: {
    processingFeeUsd: number;
    flaggedAccounts: Array<{
      partnerId: string;
      partnerName: string;
      amountUsd: number;
      status: 'blocked' | 'review_required';
      riskFactors: string[];
    }>;
    riskSummary: {
      flaggedCount: number;
      flaggedAmountUsd: number;
    };
  };
}

export interface PayoutBatchDetail {
  batch: {
    _id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    partnerCount: number;
    totals: {
      commissionUsd: number;
      bonusUsd: number;
      totalUsd: number;
    };
    createdAt: string;
    paidAt?: string;
  };
  items: Array<{
    _id: string;
    partnerId: string;
    totalUsd: number;
    commissionUsd: number;
    bonusUsd: number;
    status: string;
    partner?: {
      _id: string;
      displayName: string;
      status: string;
    } | null;
  }>;
  preflight: PayoutBatchPreview['preflight'];
}

export interface LearnerDashboardView {
  generatedAt: string;
  plan: SubscriptionPlan;
  kpis: {
    averageBand: number;
    currentStreak: number;
    testsCompleted: number;
    nextGoalBand: number;
  };
  quickPractice: Array<{
    module: IELTSModule;
    title: string;
    description: string;
    href: string;
  }>;
  resume: {
    type: 'exam' | 'simulation' | 'practice';
    examId?: string;
    simulationId?: string;
    sessionId?: string;
    title: string;
    subtitle: string;
    progressPercent: number;
    href: string;
  } | null;
  recommended: Array<{
    topicId: string;
    slug: string;
    title: string;
    description?: string;
    part: number;
    difficulty?: string;
  }>;
  activity: Array<{
    module: IELTSModule;
    itemId: string;
    title: string;
    subtitle?: string;
    status: string;
    score: number;
    durationSeconds: number;
    createdAt: string;
    href: string;
  }>;
}

export interface LearnerProgressView {
  range: '7d' | '30d' | '90d';
  module: 'all' | IELTSModule;
  totals: {
    overallBand: number;
    predictedScore: number;
    testsCompleted: number;
    studyHours: number;
  };
  trend: Array<{
    date: string;
    score: number;
    target: number;
  }>;
  skillBreakdown: {
    speaking: number;
    writing: number;
    reading: number;
    listening: number;
  };
  attempts: Array<{
    module: IELTSModule;
    itemId: string;
    title: string;
    subtitle?: string;
    status: string;
    score: number;
    durationSeconds: number;
    createdAt: string;
    href: string;
  }>;
}

export interface AdminOverviewView {
  window: '1h' | '24h' | '7d';
  kpis: {
    activeUsers: number;
    estimatedRevenueUsd: number;
    aiCostUsd: number;
    platformHealthPercent: number;
  };
  latencySeries: Array<{
    label: string;
    value: number;
  }>;
  featureFlagSummary: Array<{
    key: string;
    enabled: boolean;
    rolloutPercentage: number;
  }>;
  alerts: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId?: string;
    createdAt: string;
  }>;
  deployments: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminAnalyticsView {
  range: '7d' | '30d' | '90d';
  kpis: {
    totalRevenueUsd: number;
    activeUsersDaily: number;
    avgTokenCostUsd: number;
    grossMarginPercent: number;
  };
  trafficSeries: Array<{
    date: string;
    activeUsers: number;
    submissions: number;
  }>;
  aiExpenditure: {
    totalCostUsd: number;
    totalRequests: number;
    byModule: Array<{
      module: string;
      costUsd: number;
      requests: number;
    }>;
  };
  partnerPerformance: Array<{
    partnerId: string;
    partnerName: string;
    touches: number;
    conversions: number;
    conversionRatePercent: number;
    revenueUsd: number;
    commissionUsd: number;
  }>;
  apiHealth: Array<{
    module: string;
    total: number;
    successRatePercent: number;
    blockedCount: number;
    errorCount: number;
  }>;
}

export interface AdminPayoutOperationsRow {
  partnerId: string;
  partnerName: string;
  partnerType: 'influencer' | 'institute';
  status: 'pending' | 'processing' | 'paid';
  paymentStatus: 'pending' | 'processing' | 'paid';
  paymentMethod: string;
  attributedRevenueUsd: number;
  commissionRatePercent: number;
  calculatedPayoutUsd: number;
  payoutBreakdown: {
    unpaidUsd: number;
    processingUsd: number;
    paidUsd: number;
  };
  conversionCount: number;
  contactEmail?: string;
}

export interface AdminPayoutOperationsView {
  summary: {
    pendingPayoutUsd: number;
    pendingChangePercent: number;
    nextBatchDate: string;
    nextBatchCountdownDays: number;
    totalPaidLtmUsd: number;
    totalPaidChangePercent: number;
  };
  rows: AdminPayoutOperationsRow[];
  total: number;
  limit: number;
  offset: number;
}
