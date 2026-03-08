export type SubscriptionPlan = "free" | "premium" | "pro";

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  emailVerified: boolean;
  subscriptionPlan: SubscriptionPlan;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  isGuest?: boolean;
  guestTrialRemaining?: number;
}

export interface StandardResponse<T> {
  status: number;
  success: boolean;
  message?: string | string[];
  data?: T;
  timestamp: string;
  requestId?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Topic {
  _id: string;
  slug: string;
  title: string;
  description: string;
  part: number;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isPremium: boolean;
}

export interface PracticeTip {
  tip: string;
}

export interface PracticeSessionStart {
  sessionId: string;
  topic: Topic;
  question: string;
  timeLimit?: number;
  tips?: string[];
}

export interface BandBreakdown {
  pronunciation?: number;
  fluency?: number;
  lexicalResource?: number;
  grammaticalRange?: number;
}

export interface FluencyAnalysis {
  speechRate: number;
  pauseCount: number;
  avgPauseLength: number;
  hesitationMarkers: string[];
  selfCorrections: number;
  fillerWords: string[];
  assessment: string;
}

export interface PronunciationAnalysis {
  clarity: number;
  problematicSounds: string[];
  wordLevelErrors: Array<{
    word: string;
    issue: string;
    correction: string;
  }>;
  stressPatterns: string;
  intonation: string;
  assessment: string;
}

export interface LexicalAnalysis {
  vocabularyRange: string;
  repetitions: Array<{
    word: string;
    count: number;
  }>;
  sophisticatedWords: string[];
  collocations: string[];
  idiomaticLanguage: string[];
  inappropriateUsage: Array<{
    word: string;
    context: string;
    suggestion: string;
  }>;
  assessment: string;
}

export interface GrammaticalAnalysis {
  sentenceComplexity: string;
  errors: Array<{
    type: string;
    example: string;
    correction: string;
    explanation: string;
  }>;
  structureVariety: string[];
  tenseControl: string;
  assessment: string;
}

export interface CoherenceCohesion {
  logicalFlow: number;
  linkingWords: string[];
  topicDevelopment: string;
  organization: string;
  assessment: string;
}

export interface PracticeFeedback {
  overallBand?: number;
  bandBreakdown?: BandBreakdown;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  generatedAt?: string;
  model?: string;
  // Extended analysis fields
  fluencyAnalysis?: FluencyAnalysis;
  pronunciationAnalysis?: PronunciationAnalysis;
  lexicalAnalysis?: LexicalAnalysis;
  grammaticalAnalysis?: GrammaticalAnalysis;
  coherenceCohesion?: CoherenceCohesion;
}

export interface PracticeSession {
  _id: string;
  topicId: string;
  topicTitle: string;
  question: string;
  part: number;
  category?: string;
  difficulty?: string;
  status: "in_progress" | "completed";
  userResponse?: string;
  audioUrl?: string;
  transcription?: {
    text: string;
    duration?: number;
    confidence?: number;
    language?: string;
  };
  timeSpent?: number;
  feedback?: PracticeFeedback;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationPart {
  part: number;
  question: string;
  topicId: string;
  topicTitle?: string;
  timeLimit?: number;
  tips?: string[];
  response?: string;
  timeSpent?: number;
  feedback?: PracticeFeedback;
}

export type TestSimulationRuntimeState =
  | "preflight"
  | "intro-examiner"
  | "intro-candidate-turn"
  | "part1-examiner"
  | "part1-candidate-turn"
  | "part1-processing"
  | "part1-transition"
  | "part2-intro"
  | "part2-prep"
  | "part2-examiner-launch"
  | "part2-candidate-turn"
  | "part2-cutoff"
  | "part2-transition"
  | "part3-intro"
  | "part3-examiner"
  | "part3-candidate-turn"
  | "part3-processing"
  | "evaluation"
  | "completed"
  | "paused-retryable"
  | "failed-terminal";

export type TestSimulationRuntimeSegmentKind =
  | "cached_phrase"
  | "dynamic_prompt";

export type SpeakingTtsProvider = "openai" | "elevenlabs" | "edge-tts";
export type SpeakingSessionTurnType = "examiner" | "candidate" | "system";
export type SpeakingSessionSegmentKind =
  | "fixed_phrase"
  | "seed_prompt"
  | "cue_card"
  | "transition"
  | "dynamic_follow_up";

export interface SpeakingExaminerProfile {
  id: string;
  label: string;
  accent: string;
  provider: SpeakingTtsProvider;
  voiceId: string;
  autoAssigned: boolean;
}

export interface SpeakingSessionSegment {
  segmentId: string;
  part: number;
  phase: string;
  kind: SpeakingSessionSegmentKind;
  turnType: SpeakingSessionTurnType;
  canAutoAdvance: boolean;
  phraseId?: string;
  promptIndex?: number;
  text: string;
  audioAssetId: string;
  audioUrl: string;
  cacheKey?: string;
  provider: SpeakingTtsProvider;
  durationSeconds?: number;
}

export interface SpeakingSessionPackage {
  version: number;
  preparedAt: string;
  examinerProfile: SpeakingExaminerProfile;
  segments: SpeakingSessionSegment[];
}

export interface TestSimulationRuntimeSegment {
  kind: TestSimulationRuntimeSegmentKind;
  phraseId?: string;
  text?: string;
}

export interface TestSimulationConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TestSimulationTurnRecord {
  part: number;
  prompt: string;
  transcript?: string;
  durationSeconds?: number;
}

export interface TestSimulationRuntime {
  state: TestSimulationRuntimeState;
  currentPart: number;
  currentTurnIndex: number;
  retryCount: number;
  retryBudgetRemaining?: number;
  introStep?: "welcome" | "id_check" | "part1_begin";
  seedQuestionIndex?: number;
  followUpCount?: number;
  previousState?: TestSimulationRuntimeState;
  lastError?: string;
  failedStep?: string;
  conversationHistory?: TestSimulationConversationMessage[];
  turnHistory?: TestSimulationTurnRecord[];
  currentSegment: TestSimulationRuntimeSegment;
}

export interface SimulationStart {
  simulationId: string;
  parts: SimulationPart[];
  runtime: TestSimulationRuntime;
  sessionPackage?: SpeakingSessionPackage;
}

export interface SimulationRuntimeResponse {
  simulationId: string;
  status: "in_progress" | "completed";
  runtime: TestSimulationRuntime;
  currentPart?: SimulationPart;
  sessionPackage?: SpeakingSessionPackage;
}

export interface TestSimulation {
  _id: string;
  status: "in_progress" | "completed";
  parts: SimulationPart[];
  runtime?: TestSimulationRuntime;
  overallFeedback?: PracticeFeedback;
  overallBand?: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageSummary {
  plan: SubscriptionPlan;
  practiceCount: number;
  testCount: number;
  practiceLimit: number | null;
  testLimit: number | null;
  lastReset?: string;
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

export interface Preferences {
  _id: string;
  user: string;
  testDate?: string;
  targetBand?: string;
  timeFrame?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionMetadata {
  label: string;
  features: string[];
}

export interface SubscriptionPlanDetails {
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
}

export interface SubscriptionInfo {
  planType: SubscriptionPlan;
  status: string;
  isTrialActive: boolean;
  subscriptionDate?: string;
  trialEndsAt?: string;
  metadata: SubscriptionMetadata;
  stripe: StripeConfig;
}

export interface StripeConfig {
  enabled: boolean;
  publishableKey?: string;
  prices: {
    premium?: string;
    pro?: string;
  };
  plans?: SubscriptionPlanDetails[];
}
