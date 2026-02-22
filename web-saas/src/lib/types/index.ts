export type SubscriptionPlan = 'free' | 'premium' | 'pro';

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

export interface WritingSubmission {
  _id: string;
  overallBand: number;
  breakdown: {
    taskResponse: number;
    coherenceCohesion: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
  };
  feedback: {
    summary: string;
    inlineSuggestions: string[];
    strengths: string[];
    improvements: string[];
  };
  createdAt?: string;
}

export interface ObjectiveQuestion {
  questionId: string;
  type: string;
  prompt: string;
  options?: string[];
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

export interface ObjectiveAttempt {
  _id: string;
  attemptId?: string;
  normalizedBand?: number;
  score?: number;
  totalQuestions?: number;
  feedback?: {
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    suggestions?: string[];
  };
  status?: string;
  test?: ObjectiveTestPayload;
  testId?: ObjectiveTestPayload;
}

export interface SpeakingEvaluation {
  overallBand: number;
  spokenSummary: string;
  criteria: Record<string, unknown>;
  corrections: Array<Record<string, unknown>>;
  suggestions: Array<string | { suggestion?: string }>;
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

export interface AdminPaginationResult<T> {
  total: number;
  limit: number;
  offset: number;
  users?: T[];
  subscriptions?: T[];
}

export interface FeatureFlag {
  _id?: string;
  key: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
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
