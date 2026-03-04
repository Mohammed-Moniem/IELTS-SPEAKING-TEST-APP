import { getStoredAccessToken } from '@/lib/auth/session';
import {
  AchievementWithProgress,
  AdAnalyticsView,
  AdCampaignListResponse,
  AdCampaignRecord,
  AdPackageRecord,
  AdminAnalyticsView,
  AdminOverviewView,
  AdminPayoutOperationsView,
  AdminSubscriptionListResponse,
  AdvertiserAnalyticsView,
  AdvertiserCampaignListResponse,
  AdvertiserCampaignRecord,
  AdvertiserCampaignSubmission,
  AdvertiserCheckoutSession,
  AdvertiserPackageListResponse,
  AdvertiserSubscriptionView,
  BlogDraftResponse,
  BlogIdeasResponse,
  BlogPostDetail,
  BlogPostListResponse,
  CampaignPreflight,
  CollocationLibraryEntry,
  DiscountRedemptionResult,
  DiscountTier,
  ExamRuntimeState,
  ImprovementPlanView,
  LibraryDeckResponse,
  LibraryListResponse,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardPosition,
  LearnerDashboardView,
  LearnerProgressView,
  PayoutBatchDetail,
  PayoutBatchPreview,
  PointsSummary,
  PointsTransaction,
  ResourceLibraryEntry,
  SeoContentHealth,
  SeoRefreshQueueResult,
  SpeakingSessionDetail,
  StrengthMapView,
  VocabularyLibraryEntry,
  StandardResponse
} from '@/lib/types';

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
const DEFAULT_LOCAL_DEV_API_FALLBACK = process.env.NEXT_PUBLIC_API_FALLBACK_URL || 'http://127.0.0.1:4000/api/v1';
const USAGE_LIMIT_ERROR_CODE = 'UsageLimitReached';
const USAGE_LIMIT_TOAST_KEY = 'spokio.usage_limit.toast';
const DEFAULT_USAGE_LIMIT_MESSAGE = 'You have exceeded your monthly usage limit for your current plan. Please upgrade to continue.';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const isLocalBrowserHost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
};

const getApiBase = () => {
  const configuredBase = trimTrailingSlash(DEFAULT_API_BASE);

  // In local dev, prefer calling the backend directly when the Next.js /api rewrite isn't available.
  if (process.env.NODE_ENV !== 'production' && configuredBase.startsWith('/') && isLocalBrowserHost()) {
    return trimTrailingSlash(DEFAULT_LOCAL_DEV_API_FALLBACK);
  }

  return configuredBase;
};

export type ApiErrorCategory =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  public readonly status: number;
  public readonly category: ApiErrorCategory;
  public readonly code?: string;

  constructor(message: string, status: number, category: ApiErrorCategory, code?: string) {
    super(message);
    this.status = status;
    this.category = category;
    this.code = code;
  }
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<string | null>;
type SessionExpiredHandler = () => void;

let tokenProvider: TokenProvider = getStoredAccessToken;
let refreshHandler: RefreshHandler | null = null;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function registerApiAuthHandlers(handlers: {
  getAccessToken?: TokenProvider;
  refreshAccessToken?: RefreshHandler | null;
  onSessionExpired?: SessionExpiredHandler | null;
}) {
  tokenProvider = handlers.getAccessToken || getStoredAccessToken;
  refreshHandler = handlers.refreshAccessToken || null;
  sessionExpiredHandler = handlers.onSessionExpired || null;
}

export type ApiOptions = RequestInit & {
  token?: string;
  urc?: string;
  authOptional?: boolean;
  retryOnUnauthorized?: boolean;
};

const getErrorCategory = (status: number): ApiErrorCategory => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
};

const buildHeaders = (options: ApiOptions) => {
  const headers = new Headers(options.headers || {});
  const body = options.body;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!headers.has('Content-Type') && body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Unique-Reference-Code', options.urc || `web-saas-${Date.now()}`);

  const token = options.token || tokenProvider?.();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
};

const parseErrorFromPayload = (payload: StandardResponse<unknown>, fallbackStatus: number) => {
  const errorMessage = payload.error?.message;
  const messageFromMessageField = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
  const message = errorMessage || messageFromMessageField || `Request failed with status ${payload.status || fallbackStatus}`;
  const status = payload.status || fallbackStatus;
  const code = payload.error?.code;

  return new ApiError(message, status, getErrorCategory(status), code);
};

const isUsageLimitError = (error: ApiError) => {
  if (error.code === USAGE_LIMIT_ERROR_CODE) return true;
  if (error.status !== 403) return false;
  return /limit reached|usage limit/i.test(error.message || '');
};

const redirectToPricingForUsageLimit = (error: ApiError) => {
  if (!isUsageLimitError(error) || typeof window === 'undefined') return;

  const toastMessage = error.message || DEFAULT_USAGE_LIMIT_MESSAGE;

  try {
    window.sessionStorage.setItem(USAGE_LIMIT_TOAST_KEY, toastMessage);
  } catch {
    // Non-blocking storage failure.
  }

  if (window.location.pathname.startsWith('/pricing')) {
    window.dispatchEvent(
      new CustomEvent('spokio:usage-limit-toast', {
        detail: { message: toastMessage }
      })
    );
    return;
  }

  const target = new URL('/pricing', window.location.origin);
  target.searchParams.set('upgrade_reason', 'usage_limit');
  target.searchParams.set('upgrade_message', toastMessage);
  window.location.assign(target.toString());
};

const coerceToApiError = (value: unknown): ApiError | null => {
  if (value instanceof ApiError) return value;
  if (!value || typeof value !== 'object') return null;

  const candidate = value as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown; status?: unknown } | null;
  };

  const status =
    typeof candidate.status === 'number'
      ? candidate.status
      : typeof candidate.error?.status === 'number'
        ? candidate.error.status
        : 0;
  const code =
    typeof candidate.code === 'string'
      ? candidate.code
      : typeof candidate.error?.code === 'string'
        ? candidate.error.code
        : undefined;
  const message =
    typeof candidate.message === 'string'
      ? candidate.message
      : typeof candidate.error?.message === 'string'
        ? candidate.error.message
        : undefined;

  if (!message && !code && status === 0) return null;

  return new ApiError(message || `Request failed with status ${status || 'unknown'}`, status, getErrorCategory(status), code);
};

export const handleUsageLimitRedirect = (error: unknown) => {
  const apiError = coerceToApiError(error);
  if (!apiError) return false;
  if (!isUsageLimitError(apiError)) return false;
  redirectToPricingForUsageLimit(apiError);
  return true;
};

const requestCore = async <T>(path: string, options: ApiOptions, hasRetriedAuth = false): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers: buildHeaders(options),
      cache: 'no-store'
    });
  } catch (error: any) {
    throw new ApiError(error?.message || 'Network request failed', 0, 'network');
  }

  const shouldRetryAuth =
    response.status === 401 &&
    options.authOptional !== true &&
    options.retryOnUnauthorized !== false &&
    !hasRetriedAuth &&
    !!refreshHandler;

  if (shouldRetryAuth) {
    const refreshedToken = await refreshHandler!();
    if (refreshedToken) {
      return requestCore(path, { ...options, token: refreshedToken }, true);
    }
    sessionExpiredHandler?.();
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status, getErrorCategory(response.status));
    }

    throw new ApiError('Expected JSON response but received non-JSON payload', response.status, 'unknown');
  }

  const payload = (await response.json()) as StandardResponse<T>;
  if (!payload.success) {
    const parsedError = parseErrorFromPayload(payload, response.status);
    redirectToPricingForUsageLimit(parsedError);
    throw parsedError;
  }

  if (typeof payload.data === 'undefined') {
    return undefined as T;
  }

  return payload.data;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    return await requestCore<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError) {
      redirectToPricingForUsageLimit(error);
    }
    throw error;
  }
}

export async function apiRaw(path: string, options: ApiOptions = {}) {
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers: buildHeaders(options),
      cache: 'no-store'
    });
  } catch (error: any) {
    throw new ApiError(error?.message || 'Network request failed', 0, 'network');
  }

  const shouldRetryAuth =
    response.status === 401 && options.authOptional !== true && options.retryOnUnauthorized !== false && !!refreshHandler;

  if (shouldRetryAuth) {
    const refreshedToken = await refreshHandler!();
    if (refreshedToken) {
      return apiRaw(path, { ...options, token: refreshedToken, retryOnUnauthorized: false });
    }
    sessionExpiredHandler?.();
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isJson) {
      const payload = (await response.json()) as StandardResponse<unknown>;
      const parsedError = parseErrorFromPayload(payload, response.status);
      redirectToPricingForUsageLimit(parsedError);
      throw parsedError;
    }

    const text = await response.text();
    let parsedError: ApiError;
    try {
      const maybePayload = JSON.parse(text) as StandardResponse<unknown>;
      parsedError = parseErrorFromPayload(maybePayload, response.status);
    } catch {
      parsedError = new ApiError(
        text || `Request failed with status ${response.status}`,
        response.status,
        getErrorCategory(response.status)
      );
    }
    redirectToPricingForUsageLimit(parsedError);
    throw parsedError;
  }

  return response;
}

export const webApi = {
  getLearnerDashboardView() {
    return apiRequest<LearnerDashboardView>('/app/dashboard-view');
  },
  getLearnerProgressView(params?: { range?: '7d' | '30d' | '90d'; module?: 'all' | 'speaking' | 'writing' | 'reading' | 'listening' }) {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.module) query.set('module', params.module);
    return apiRequest<LearnerProgressView>(`/app/progress-view${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getAdminOverviewView(params?: { window?: '1h' | '24h' | '7d' }) {
    const query = new URLSearchParams();
    if (params?.window) query.set('window', params.window);
    return apiRequest<AdminOverviewView>(`/admin/overview-view${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getAdminAnalyticsView(params?: { range?: '7d' | '30d' | '90d' }) {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    return apiRequest<AdminAnalyticsView>(`/admin/analytics-view${query.toString() ? `?${query.toString()}` : ''}`);
  },
  listAdminSubscriptions(params?: {
    query?: string;
    status?: 'active' | 'canceled' | 'past_due' | 'incomplete';
    plan?: 'free' | 'premium' | 'pro' | 'team';
    renewalFrom?: string;
    renewalTo?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.query) query.set('query', params.query);
    if (params?.status) query.set('status', params.status);
    if (params?.plan) query.set('plan', params.plan);
    if (params?.renewalFrom) query.set('renewalFrom', params.renewalFrom);
    if (params?.renewalTo) query.set('renewalTo', params.renewalTo);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<AdminSubscriptionListResponse>(`/admin/subscriptions${query.toString() ? `?${query.toString()}` : ''}`);
  },
  updateAdminSubscriptionStatus(
    subscriptionId: string,
    payload: { status: 'active' | 'canceled' | 'past_due' | 'incomplete' }
  ) {
    return apiRequest(`/admin/subscriptions/${subscriptionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  updateAdminSubscriptionPlan(
    subscriptionId: string,
    payload: { planType: 'free' | 'premium' | 'pro' | 'team' }
  ) {
    return apiRequest(`/admin/subscriptions/${subscriptionId}/plan`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  logAdminSubscriptionRefundNote(subscriptionId: string, payload: { note: string }) {
    return apiRequest(`/admin/subscriptions/${subscriptionId}/refund-note`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  exportAdminAnalyticsView(params?: { range?: '7d' | '30d' | '90d'; format?: 'json' | 'csv' }) {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.format) query.set('format', params.format);
    return apiRaw(`/admin/analytics-view/export${query.toString() ? `?${query.toString()}` : ''}`, {
      authOptional: false
    });
  },
  getAdminPayoutOperationsView(params?: {
    status?: 'all' | 'pending' | 'processing' | 'paid';
    sort?: 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.sort) query.set('sort', params.sort);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<AdminPayoutOperationsView>(`/admin/partners/payout-operations-view${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getPracticeSessionDetail(sessionId: string) {
    return apiRequest<SpeakingSessionDetail>(`/practice/sessions/${sessionId}`);
  },
  getExamRuntime(examId: string) {
    return apiRequest<ExamRuntimeState>(`/exams/full/${examId}/runtime`);
  },
  pauseExam(
    examId: string,
    payload: {
      currentModule?: 'speaking' | 'writing' | 'reading' | 'listening';
      currentQuestionIndex?: number;
      remainingSecondsByModule?: Partial<Record<'speaking' | 'writing' | 'reading' | 'listening', number>>;
      resumeToken?: string;
    }
  ) {
    return apiRequest(`/exams/full/${examId}/pause`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  resumeExam(
    examId: string,
    payload: {
      currentModule?: 'speaking' | 'writing' | 'reading' | 'listening';
      currentQuestionIndex?: number;
      remainingSecondsByModule?: Partial<Record<'speaking' | 'writing' | 'reading' | 'listening', number>>;
      resumeToken?: string;
    }
  ) {
    return apiRequest(`/exams/full/${examId}/resume`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  preflightCampaign(payload: Record<string, unknown>) {
    return apiRequest<CampaignPreflight>('/admin/notifications/campaigns/preflight', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  previewPayoutBatch(payload: {
    periodStart: string;
    periodEnd: string;
    partnerIds?: string[];
    notes?: string;
  }) {
    return apiRequest<PayoutBatchPreview>('/admin/partners/payout-batches/preview', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getPayoutBatchDetail(batchId: string) {
    return apiRequest<PayoutBatchDetail>(`/admin/partners/payout-batches/${batchId}`);
  },
  listBlogPosts(params?: { cluster?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.cluster) query.set('cluster', params.cluster);
    if (params?.search) query.set('search', params.search);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<BlogPostListResponse>(`/blog/posts${query.toString() ? `?${query.toString()}` : ''}`, {
      authOptional: true
    });
  },
  getBlogPost(slug: string) {
    return apiRequest<BlogPostDetail>(`/blog/posts/${slug}`, {
      authOptional: true
    });
  },
  listAdminBlogPosts(params?: {
    cluster?: string;
    state?: 'idea' | 'outline' | 'draft' | 'qa_passed' | 'pending_review' | 'published' | 'archived';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.cluster) query.set('cluster', params.cluster);
    if (params?.state) query.set('state', params.state);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<BlogPostListResponse>(`/admin/blog/posts${query.toString() ? `?${query.toString()}` : ''}`);
  },
  generateBlogIdeas(payload: { cluster?: string; count?: number }) {
    return apiRequest<BlogIdeasResponse>('/admin/blog/generate-ideas', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  createBlogDraft(payload: {
    title: string;
    slug?: string;
    cluster?: string;
    tags?: string[];
    excerpt?: string;
    body?: string;
    contentRisk?: 'low_risk_update' | 'pillar' | 'commercial';
    scheduleAutoPublish?: boolean;
    scheduledAt?: string;
  }) {
    return apiRequest<BlogDraftResponse>('/admin/blog/drafts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  reviewBlogPost(postId: string, payload: { decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string }) {
    return apiRequest<BlogPostDetail>(`/admin/blog/${postId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  publishBlogPost(postId: string) {
    return apiRequest<BlogPostDetail>(`/admin/blog/${postId}/publish`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },
  getSeoContentHealth() {
    return apiRequest<SeoContentHealth>('/admin/seo/content-health');
  },
  enqueueSeoRefreshQueue(payload: { cluster?: string; limit?: number }) {
    return apiRequest<SeoRefreshQueueResult>('/admin/seo/refresh-queue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getStrengthMap(range: '7d' | '30d' | '90d' = '30d') {
    return apiRequest<StrengthMapView>(`/app/insights/strength-map?range=${range}`);
  },
  getImprovementPlan(module: 'all' | 'speaking' | 'writing' | 'reading' | 'listening' = 'all') {
    return apiRequest<ImprovementPlanView>(`/app/insights/improvement-plan?module=${module}`);
  },
  listCollocations(params?: {
    search?: string;
    topic?: string;
    module?: 'speaking' | 'writing' | 'reading' | 'listening';
    cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.topic) query.set('topic', params.topic);
    if (params?.module) query.set('module', params.module);
    if (params?.cefr) query.set('cefr', params.cefr);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<LibraryListResponse<CollocationLibraryEntry>>(
      `/library/collocations${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  listVocabulary(params?: {
    search?: string;
    topic?: string;
    module?: 'speaking' | 'writing' | 'reading' | 'listening';
    cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.topic) query.set('topic', params.topic);
    if (params?.module) query.set('module', params.module);
    if (params?.cefr) query.set('cefr', params.cefr);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<LibraryListResponse<VocabularyLibraryEntry>>(
      `/library/vocabulary${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  listBooks(params?: {
    search?: string;
    topic?: string;
    module?: 'speaking' | 'writing' | 'reading' | 'listening';
    cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.topic) query.set('topic', params.topic);
    if (params?.module) query.set('module', params.module);
    if (params?.cefr) query.set('cefr', params.cefr);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<LibraryListResponse<ResourceLibraryEntry>>(
      `/library/resources/books${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  listChannels(params?: {
    search?: string;
    topic?: string;
    module?: 'speaking' | 'writing' | 'reading' | 'listening';
    cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.topic) query.set('topic', params.topic);
    if (params?.module) query.set('module', params.module);
    if (params?.cefr) query.set('cefr', params.cefr);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<LibraryListResponse<ResourceLibraryEntry>>(
      `/library/resources/channels${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  createLibraryDeck(payload: {
    name: string;
    description?: string;
    entryType: 'collocation' | 'vocabulary' | 'resource';
    entryIds: string[];
  }) {
    return apiRequest<LibraryDeckResponse>('/library/decks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getLibraryReviewQueue(limit?: number) {
    const query = typeof limit === 'number' ? `?limit=${limit}` : '';
    return apiRequest<{
      generatedAt: string;
      dueCount: number;
      items: Array<{
        eventId: string;
        deckId: string;
        deckName: string;
        entryType: 'collocation' | 'vocabulary' | 'resource';
        entryId: string;
        intervalDays: number;
        nextReviewAt?: string;
      }>;
    }>(`/library/decks/review-queue${query}`);
  },
  recordDeckReviewEvent(
    deckId: string,
    payload: { entryId: string; rating: 'again' | 'hard' | 'good' | 'easy' | 'mastered'; qualityScore?: number }
  ) {
    return apiRequest<{
      eventId: string;
      deckId: string;
      entryId: string;
      rating: 'again' | 'hard' | 'good' | 'easy' | 'mastered';
      intervalDays: number;
      nextReviewAt?: string;
    }>(`/library/decks/${deckId}/review-events`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  createAdPackage(payload: {
    key: string;
    name: string;
    description: string;
    placementType: 'homepage_sponsor' | 'module_panel' | 'blog_block' | 'newsletter_slot' | 'partner_spotlight';
    billingType: 'monthly_subscription' | 'quarterly_subscription' | 'annual_subscription' | 'one_time';
    stripePriceId?: string;
    currency?: string;
    priceAmount: number;
    features?: string[];
    isActive?: boolean;
  }) {
    return apiRequest<AdPackageRecord>('/admin/ads/packages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  listAdCampaigns(params?: {
    status?: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<AdCampaignListResponse>(`/admin/ads/campaigns${query.toString() ? `?${query.toString()}` : ''}`);
  },
  createAdCampaign(payload: {
    name: string;
    packageId: string;
    advertiserAccountId?: string;
    startsAt?: string;
    endsAt?: string;
    targeting?: Record<string, unknown>;
    creative?: Record<string, unknown>;
  }) {
    return apiRequest<{ campaignId: string; status: AdCampaignRecord['status'] }>('/admin/ads/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateAdCampaignStatus(id: string, payload: { status: AdCampaignRecord['status']; notes?: string }) {
    return apiRequest<AdCampaignRecord>(`/admin/ads/campaigns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  getAdAnalytics() {
    return apiRequest<AdAnalyticsView>('/admin/ads/analytics');
  },
  createAdvertiserCheckoutSession(payload: {
    packageId: string;
    successUrl: string;
    cancelUrl: string;
    couponCode?: string;
  }) {
    return apiRequest<AdvertiserCheckoutSession>('/advertisers/checkout-session', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getAdvertiserSubscription() {
    return apiRequest<AdvertiserSubscriptionView>('/advertisers/subscription');
  },
  listAdvertiserCampaigns(params?: {
    status?: AdvertiserCampaignRecord['status'];
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    return apiRequest<AdvertiserCampaignListResponse>(
      `/advertisers/campaigns${query.toString() ? `?${query.toString()}` : ''}`
    );
  },
  submitAdvertiserCampaign(payload: AdvertiserCampaignSubmission) {
    return apiRequest<{ campaignId: string; status: string }>(
      '/advertisers/campaigns',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },
  getAdvertiserAnalytics() {
    return apiRequest<AdvertiserAnalyticsView>('/advertisers/analytics');
  },
  listAdvertiserPackages() {
    return apiRequest<AdvertiserPackageListResponse>('/advertisers/packages', {
      authOptional: true
    });
  },
  createAdvertiserBillingPortal(payload: { returnUrl: string }) {
    return apiRequest<{ portalUrl: string }>(
      '/advertisers/billing-portal',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  /* ── Public Sponsored Content (learner-facing) ── */

  getActiveSponsoredContent(slot: import('@/lib/types').SponsorPlacementSlot) {
    return apiRequest<import('@/lib/types').PublicSponsoredContentResponse>(
      `/sponsored-content?slot=${slot}`
    );
  },

  trackSponsoredImpression(contentId: string) {
    return apiRequest<void>(
      `/sponsored-content/${contentId}/impression`,
      { method: 'POST' }
    );
  },

  trackSponsoredClick(contentId: string) {
    return apiRequest<void>(
      `/sponsored-content/${contentId}/click`,
      { method: 'POST' }
    );
  },

  /* ── Achievements ── */
  getAchievements(category?: string) {
    const query = category ? `?category=${category}` : '';
    return apiRequest<AchievementWithProgress[]>(`/achievements${query}`);
  },
  getMyAchievements() {
    return apiRequest<AchievementWithProgress[]>('/achievements/me');
  },
  getAchievementProgress() {
    return apiRequest<AchievementWithProgress[]>('/achievements/progress');
  },

  /* ── Leaderboard ── */
  getLeaderboard(params?: { period?: LeaderboardPeriod; metric?: LeaderboardMetric; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.metric) query.set('metric', params.metric);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    return apiRequest<LeaderboardEntry[]>(`/leaderboard${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getFriendsLeaderboard(params?: { period?: LeaderboardPeriod; metric?: LeaderboardMetric }) {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.metric) query.set('metric', params.metric);
    return apiRequest<LeaderboardEntry[]>(`/leaderboard/friends${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getMyLeaderboardPosition(params?: { period?: LeaderboardPeriod; metric?: LeaderboardMetric }) {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.metric) query.set('metric', params.metric);
    return apiRequest<LeaderboardPosition>(`/leaderboard/position${query.toString() ? `?${query.toString()}` : ''}`);
  },
  leaderboardOptIn() {
    return apiRequest<void>('/leaderboard/opt-in', { method: 'POST' });
  },
  leaderboardOptOut() {
    return apiRequest<void>('/leaderboard/opt-out', { method: 'POST' });
  },

  /* ── Points & Rewards ── */
  getPointsSummary() {
    return apiRequest<PointsSummary>('/points/summary');
  },
  getPointsTransactions(limit?: number) {
    const query = typeof limit === 'number' ? `?limit=${limit}` : '';
    return apiRequest<PointsTransaction[]>(`/points/transactions${query}`);
  },
  getPointsBalance() {
    return apiRequest<{ balance: number }>('/points/balance');
  },
  redeemPoints(discountTier: DiscountTier) {
    return apiRequest<DiscountRedemptionResult>('/points/redeem', {
      method: 'POST',
      body: JSON.stringify({ discountTier })
    });
  }
};
