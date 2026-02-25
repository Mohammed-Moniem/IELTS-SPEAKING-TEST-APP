import { getStoredAccessToken } from '@/lib/auth/session';
import {
  AdminAnalyticsView,
  AdminOverviewView,
  AdminPayoutOperationsView,
  CampaignPreflight,
  ExamRuntimeState,
  LearnerDashboardView,
  LearnerProgressView,
  PayoutBatchDetail,
  PayoutBatchPreview,
  SpeakingSessionDetail,
  StandardResponse
} from '@/lib/types';

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

const getApiBase = () => DEFAULT_API_BASE.replace(/\/$/, '');

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

  constructor(message: string, status: number, category: ApiErrorCategory) {
    super(message);
    this.status = status;
    this.category = category;
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
  const message = Array.isArray(payload.message)
    ? payload.message.join(', ')
    : payload.message || `Request failed with status ${payload.status || fallbackStatus}`;
  const status = payload.status || fallbackStatus;

  return new ApiError(message, status, getErrorCategory(status));
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
    throw parseErrorFromPayload(payload, response.status);
  }

  if (typeof payload.data === 'undefined') {
    throw new ApiError('Response payload missing data', payload.status || response.status || 500, 'unknown');
  }

  return payload.data;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return requestCore<T>(path, options);
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
    const text = await response.text();
    throw new ApiError(text || `Request failed with status ${response.status}`, response.status, getErrorCategory(response.status));
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
  }
};
