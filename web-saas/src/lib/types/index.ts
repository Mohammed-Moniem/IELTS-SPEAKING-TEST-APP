export type SubscriptionPlan = 'free' | 'premium' | 'pro' | 'team';
export type BillingCycle = 'monthly' | 'annual';

export type AdminRole = 'superadmin' | 'content_manager' | 'support_agent';

/* ── Guide / IELTS content types ── */

export type GuideModule =
  | 'speaking'
  | 'writing'
  | 'reading'
  | 'listening'
  | 'vocabulary'
  | 'exam-strategy'
  | 'band-scores'
  | 'resources'
  | 'faq'
  | 'updates'
  | 'offers'
  | 'membership';

export type GuideContentClass =
  | 'class_a_core_learning'
  | 'class_b_reference'
  | 'class_c_updates_promo';

export interface GuidePageSummary {
  id: string;
  slug: string;
  canonicalPath: string;
  title: string;
  excerpt?: string;
  module: GuideModule;
  pageType: string;
  contentClass: GuideContentClass;
  state: string;
  qaPassed: boolean;
  qaScore: number;
  publishedAt?: string;
  lastReviewedAt?: string;
  updatedAt?: string;
}

export interface GuidePageDetail extends GuidePageSummary {
  depth: number;
  order: number;
  legacySlugs: string[];
  track: string;
  intent?: string;
  templateType: string;
  metaTitle?: string;
  metaDescription?: string;
  bodyMarkdown?: string;
  keyTakeaways?: string[];
  faqItems?: { question: string; answer: string }[];
  practiceBlocks?: {
    quickAnswer?: string;
    commonMistakes?: string[];
    stepByStepMethod?: string[];
    timedPracticeDrill?: string;
    selfCheckChecklist?: string[];
  };
  ctaConfig?: {
    primary?: { label: string; href: string };
    secondary?: { label: string; href: string };
  };
  contentRisk?: string;
  citationCoverageScore?: number;
  duplicationScore?: number;
  readabilityScore?: number;
  linkValidationPassed?: boolean;
  schemaValidationPassed?: boolean;
  sourceUrls?: string[];
  sourceSnapshotVersion?: string;
  rewriteNotes?: string;
  noindex?: boolean;
  changeFrequency?: string;
  priority?: number;
  createdAt?: string;
}

export interface GuideTreeNode {
  id: string;
  title: string;
  slug: string;
  canonicalPath: string;
  module: GuideModule;
  contentClass: GuideContentClass;
  pageType: string;
  templateType: string;
  depth: number;
  order: number;
  excerpt?: string;
  children: GuideTreeNode[];
}

export interface GuideTreeResponse {
  generatedAt: string;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  tree: GuideTreeNode[];
  flat: GuideTreeNode[];
}

export interface GuideDetailResponse {
  page: GuidePageDetail;
  related: GuidePageSummary[];
}

export type IELTSModule = 'speaking' | 'writing' | 'reading' | 'listening';

export type IELTSModuleTrack = 'academic' | 'general';

export interface StandardResponse<T> {
  status: number;
  success: boolean;
  message?: string | string[];
  error?: {
    code: string;
    message: string;
    description?: string;
    details?: unknown;
  };
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
  advertiserPortal?: AdvertiserPortalStatus;
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
  overall?: WritingOverallBandDetails;
  criteria?: WritingDeepFeedback;
}

export interface WritingEvidenceItem {
  issue: string;
  quotedText: string;
  whyItCostsBand: string;
  revision: string;
  whyRevisionIsBetter: string;
  practiceInstruction: string;
}

export interface WritingBandUpgradeExamples {
  nextBandSnippet: string;
  band9Snippet: string;
  differenceNotes: string[];
}

export interface WritingCriterionDetails {
  band: number;
  descriptorSummary: string;
  strengths: string[];
  limitations: string[];
  evidence: WritingEvidenceItem[];
  whyNotHigher: string[];
  howToReach8: string[];
  howToReach9: string[];
  targetedDrills: string[];
  commonExaminerPenaltyTriggers: string[];
  bandUpgradeExamples?: WritingBandUpgradeExamples;
}

export interface WritingDeepFeedback {
  taskAchievementOrResponse: WritingCriterionDetails;
  coherenceCohesion: WritingCriterionDetails;
  lexicalResource: WritingCriterionDetails;
  grammaticalRangeAccuracy: WritingCriterionDetails;
}

export interface WritingOverallBandDetails {
  band: number;
  label: string;
  examinerSummary: string;
  whyThisBand: string[];
  bandGapTo8: string[];
  bandGapTo9: string[];
  priorityOrder: string[];
  nextSteps24h: string[];
  nextSteps7d: string[];
  nextSteps14d: string[];
}

export interface WritingSubmission {
  _id: string;
  taskId?: string | WritingTask;
  track?: IELTSModuleTrack;
  taskType?: 'task1' | 'task2';
  responseText?: string;
  overallBand: number;
  wordCount?: number;
  durationSeconds?: number;
  feedbackVersion?: 'v1' | 'v2';
  deepFeedbackReady?: boolean;
  breakdown: WritingSubmissionBreakdown;
  feedback: WritingSubmissionFeedback;
  createdAt?: string;
}

export interface ObjectiveQuestion {
  questionId: string;
  sectionId?: 'p1' | 'p2' | 'p3';
  groupId?: string;
  type:
    | 'multiple_choice'
    | 'multiple_choice_single'
    | 'multiple_choice_multiple'
    | 'true_false_not_given'
    | 'yes_no_not_given'
    | 'matching_headings'
    | 'matching_information'
    | 'matching_features'
    | 'matching_sentence_endings'
    | 'sentence_completion'
    | 'summary_completion'
    | 'note_table_flow_completion'
    | 'diagram_label_completion'
    | 'short_answer'
    | string;
  prompt: string;
  instructions?: string;
  options?: string[];
  answerSpec?: {
    kind: 'single' | 'multi' | 'ordered' | 'map';
    value: string | string[] | Record<string, string>;
    caseSensitive?: boolean;
    maxWords?: number;
  };
  explanation?: string;
  correctAnswer?: string;
}

export interface ObjectivePassageSection {
  sectionId: 'p1' | 'p2' | 'p3';
  title: string;
  passageText: string;
  suggestedMinutes: number;
  questions: ObjectiveQuestion[];
}

export interface ObjectiveTestPayload {
  testId: string;
  title: string;
  track: IELTSModuleTrack;
  schemaVersion?: 'v1' | 'v2';
  sectionCount?: number;
  sections?: ObjectivePassageSection[];
  questions: ObjectiveQuestion[];
  passageTitle?: string;
  passageText?: string;
  transcript?: string;
  audioUrl?: string;
  suggestedTimeMinutes: number;
}

export interface ObjectiveAnswer {
  questionId: string;
  sectionId?: 'p1' | 'p2' | 'p3';
  answer: string | string[] | Record<string, string>;
  isCorrect?: boolean;
  questionType?: string;
  expectedAnswer?: string | string[] | Record<string, string>;
  feedbackHint?: string;
}

export interface ObjectiveAttempt {
  _id: string;
  attemptId?: string;
  schemaVersion?: 'v1' | 'v2';
  feedbackVersion?: 'v1' | 'v2';
  deepFeedbackReady?: boolean;
  deepFeedback?: {
    overallSummary?: string;
    sectionCoaching?: Array<{
      sectionId: 'p1' | 'p2' | 'p3';
      focusAreas?: string[];
      traps?: string[];
      drills?: string[];
    }>;
    questionTypeCoaching?: Array<{
      type: string;
      whyWrong?: string[];
      fixes?: string[];
      drills?: string[];
    }>;
    top5Fixes?: string[];
    next24hPlan?: string[];
    next7dPlan?: string[];
  };
  sectionProgress?: Array<{
    sectionId: 'p1' | 'p2' | 'p3';
    answeredCount: number;
    totalCount: number;
    correctCount: number;
  }>;
  sectionStats?: Array<{
    sectionId: 'p1' | 'p2' | 'p3';
    score: number;
    total: number;
  }>;
  questionTypeStats?: Array<{
    type: string;
    correct: number;
    total: number;
  }>;
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

export interface AdminSubscriptionRecord {
  _id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  planType: SubscriptionPlan;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  subscriptionDate?: string;
  trialEndsAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminSubscriptionListResponse {
  subscriptions: AdminSubscriptionRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminKpiDelta {
  current: number;
  previous: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'flat';
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
  kpiDeltas: {
    activeUsers: AdminKpiDelta;
    estimatedRevenueUsd: AdminKpiDelta;
    aiCostUsd: AdminKpiDelta;
    platformHealthPercent: AdminKpiDelta;
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
    severity: 'critical' | 'warning' | 'info';
    details?: Record<string, unknown>;
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
  kpiDeltas: {
    totalRevenueUsd: AdminKpiDelta;
    activeUsersDaily: AdminKpiDelta;
    avgTokenCostUsd: AdminKpiDelta;
    grossMarginPercent: AdminKpiDelta;
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
  funnel: Array<{
    key: 'visit' | 'register' | 'first_practice' | 'first_paid' | 'retained_30d';
    label: string;
    count: number;
    conversionFromPreviousPercent: number;
  }>;
  cohortSlices: {
    plan: Record<'free' | 'premium' | 'pro' | 'team', number>;
    modulePreference: Record<'speaking' | 'writing' | 'reading' | 'listening', number>;
    acquisitionChannel: Record<'direct' | 'partner_register' | 'partner_checkout' | 'partner_manual', number>;
  };
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

/* ── Gamification ── */

export type AchievementCategory = 'practice' | 'improvement' | 'streak' | 'social' | 'milestone' | 'speed' | 'consistency' | 'mastery' | 'seasonal';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type LeaderboardMetric = 'score' | 'practices' | 'achievements' | 'streak';
export type DiscountTier = '5%' | '10%' | '15%' | '20%';

export interface Achievement {
  _id: string;
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier?: AchievementTier;
  icon: string;
  points: number;
  requirement: {
    type: string;
    value: number;
    metadata?: Record<string, unknown>;
  };
  isPremium: boolean;
  isActive: boolean;
  order: number;
}

export interface AchievementWithProgress extends Achievement {
  userProgress?: {
    progress: number;
    isUnlocked: boolean;
    unlockedAt?: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  totalSessions: number;
  achievements: number;
  achievementPoints?: number;
  streak: number;
  isCurrentUser: boolean;
  isFriend?: boolean;
}

export interface LeaderboardPosition {
  rank: number;
  score: number;
  totalUsers: number;
  percentile: number;
}

export interface PointsSummary {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  currentTier: { tier: DiscountTier; percentage: number; pointsRequired: number } | null;
  nextTier: { tier: DiscountTier; percentage: number; pointsRequired: number; pointsNeeded: number } | null;
  canRedeem: boolean;
  activeDiscounts: Array<Record<string, unknown>>;
}

export interface PointsTransaction {
  _id: string;
  userId: string;
  type: string;
  amount: number;
  balance: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DiscountRedemptionResult {
  couponCode: string;
  discountPercentage: number;
  pointsRedeemed: number;
  billingPeriod: string;
  expiresAt: string;
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

export type BlogPostState = 'idea' | 'outline' | 'draft' | 'qa_passed' | 'pending_review' | 'published' | 'archived';
export type BlogContentRisk = 'low_risk_update' | 'pillar' | 'commercial';

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cluster: string;
  tags: string[];
  state: BlogPostState;
  contentRisk: BlogContentRisk;
  qaPassed: boolean;
  qaScore?: number;
  publishedAt?: string;
  lastReviewedAt?: string;
  lastUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  body: string;
  sourceLinks: string[];
  qaReportId?: string;
}

export interface BlogPostListResponse {
  posts: BlogPostSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface BlogDraftResponse {
  post: BlogPostDetail;
  qaReport: {
    id: string;
    passed: boolean;
    score: number;
    factCheckConfidence: number;
    duplicationScore: number;
    readabilityScore: number;
    linkValidationPassed: boolean;
    schemaValidationPassed: boolean;
    warnings: string[];
  };
}

export interface BlogIdeasResponse {
  jobId: string;
  ideas: BlogPostSummary[];
}

export interface SeoContentHealth {
  generatedAt: string;
  totals: {
    totalPosts: number;
    publishedPosts: number;
    pendingReviewPosts: number;
    failedQaPosts: number;
    schemaFailures: number;
    brokenLinkPosts: number;
    queuedJobs: number;
  };
  clusters: Array<{
    key: string;
    name: string;
    refreshCadenceDays: number;
    publishedCount: number;
    staleCount: number;
    queuedRefreshJobs: number;
  }>;
}

export interface SeoRefreshQueueResult {
  queued: number;
  skipped: number;
  postIds: string[];
}

export interface StrengthCriterion {
  key: string;
  module: IELTSModule;
  label: string;
  averageScore: number;
  confidence: 'low' | 'medium' | 'high';
  dataPoints: number;
  confidenceBand: {
    low: number;
    high: number;
  };
  trend: Array<{ x: string; y: number }>;
}

export interface StrengthMapView {
  generatedAt: string;
  range: '7d' | '30d' | '90d';
  from: string;
  to: string;
  dataSufficiency: 'low' | 'medium' | 'high';
  criteria: StrengthCriterion[];
  strongest: StrengthCriterion[];
  weakest: StrengthCriterion[];
}

export interface ImprovementPlanCard {
  criterionKey: string;
  module: IELTSModule;
  title: string;
  currentBand: number;
  targetBand: number;
  deltaToTarget: number;
  confidence: number;
  dataPoints: number;
  expectedBandImpact: number;
  recommendedAction: string;
  deepLink: string;
  supportingResources: Array<{
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    url?: string;
  }>;
}

export interface ImprovementPlanView {
  generatedAt: string;
  module: IELTSModule | 'all';
  dataSufficiency: 'low' | 'medium' | 'high';
  predictionConfidence: 'low' | 'medium' | 'high';
  cards: ImprovementPlanCard[];
}

export interface CollocationLibraryEntry {
  id: string;
  phrase: string;
  meaning: string;
  module: IELTSModule;
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic?: string;
  examples: string[];
  alternatives: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  qualityScore: number;
}

export interface VocabularyLibraryEntry {
  id: string;
  lemma: string;
  definition: string;
  module: IELTSModule;
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic?: string;
  synonyms: string[];
  examples: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  qualityScore: number;
}

export interface ResourceLibraryEntry {
  id: string;
  type: 'book' | 'channel';
  title: string;
  provider?: string;
  url?: string;
  description?: string;
  module: IELTSModule | 'all';
  topic?: string;
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  sponsored: boolean;
  sponsorPartnerId?: string;
  qualityScore: number;
}

export interface LibraryListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface LibraryDeckResponse {
  deck: {
    id: string;
    name: string;
    description?: string;
    entryType: 'collocation' | 'vocabulary' | 'resource';
    entryIds: string[];
    createdAt: string;
    updatedAt: string;
  };
  addedEntries: number;
}

export interface AdPackageRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  placementType: 'homepage_sponsor' | 'module_panel' | 'blog_block' | 'newsletter_slot' | 'partner_spotlight';
  billingType: 'monthly_subscription' | 'quarterly_subscription' | 'annual_subscription' | 'one_time';
  stripePriceId?: string;
  currency: string;
  priceAmount: number;
  features: string[];
  isActive: boolean;
}

export interface AdCampaignRecord {
  id: string;
  name: string;
  status: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';
  placementType: AdPackageRecord['placementType'];
  package: AdPackageRecord | null;
  advertiser: {
    id: string;
    displayName: string;
    contactEmail: string;
    status: string;
  } | null;
  startsAt?: string;
  endsAt?: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdCampaignListResponse {
  items: AdCampaignRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdAnalyticsView {
  generatedAt: string;
  totals: {
    campaignCount: number;
    advertiserCount: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctrPercent: number;
    estimatedMonthlyRevenueUsd: number;
  };
  byStatus: Record<string, number>;
  byPlacement: Record<string, number>;
  topCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    placementType: string;
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
    };
    ctr: number;
  }>;
}

export interface AdvertiserCheckoutSession {
  checkoutSessionId: string;
  checkoutUrl?: string;
  mode: 'subscription' | 'payment';
  package: AdPackageRecord;
  advertiser: {
    id: string;
    status: string;
    stripeCustomerId?: string;
  };
}

export interface AdvertiserSubscriptionView {
  hasAccount: boolean;
  advertiser?: {
    id: string;
    displayName: string;
    contactEmail: string;
    status: string;
    affiliateCode?: string;
    monthlyBudgetUsd?: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingStatus?: 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'unknown';
    lastInvoiceStatus?: string;
    lastInvoiceAt?: string;
    failedPaymentCount?: number;
  };
  activePackage?: AdPackageRecord | null;
  stripeSubscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
  } | null;
}

/* ── Advertiser Portal ── */

export interface AdvertiserPortalStatus {
  isAdvertiser: boolean;
  status?: string;
  advertiserId?: string;
}

export interface AdvertiserCampaignRecord {
  id: string;
  name: string;
  status: AdCampaignRecord['status'];
  placementType: AdPackageRecord['placementType'];
  packageName: string;
  startsAt?: string;
  endsAt?: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdvertiserCampaignListResponse {
  items: AdvertiserCampaignRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdvertiserAnalyticsView {
  generatedAt: string;
  totals: {
    activeCampaigns: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctrPercent: number;
    spendToDateUsd: number;
  };
  byCampaign: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  }>;
}

export interface AdvertiserCampaignSubmission {
  name: string;
  packageId: string;
  headline: string;
  description?: string;
  ctaUrl: string;
  ctaLabel?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface AdvertiserPackageListResponse {
  packages: AdPackageRecord[];
}

/* ── Public-facing sponsored content (learner side) ── */

export type SponsorPlacementSlot =
  | 'homepage_sponsor'
  | 'module_panel'
  | 'blog_block'
  | 'newsletter_slot'
  | 'partner_spotlight';

export interface PublicSponsoredContent {
  id: string;
  headline: string;
  description?: string;
  ctaUrl: string;
  ctaLabel: string;
  advertiserName: string;
  placementSlot: SponsorPlacementSlot;
  impressionTrackUrl?: string;
  clickTrackUrl?: string;
}

export interface PublicSponsoredContentResponse {
  items: PublicSponsoredContent[];
  slot: SponsorPlacementSlot;
}
