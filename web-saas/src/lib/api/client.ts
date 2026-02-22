import { getStoredAccessToken } from '@/lib/auth/session';
import { StandardResponse } from '@/lib/types';

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

const getApiBase = () => DEFAULT_API_BASE.replace(/\/$/, '');

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = RequestInit & {
  token?: string;
  urc?: string;
  authOptional?: boolean;
};

const buildHeaders = (options: ApiOptions) => {
  const headers = new Headers(options.headers || {});
  const body = options.body;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!headers.has('Content-Type') && body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Unique-Reference-Code', options.urc || `web-saas-${Date.now()}`);

  const token = options.token || getStoredAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (!options.authOptional) {
    // Keep header absent; server will enforce auth where required.
  }

  return headers;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: buildHeaders(options),
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    throw new ApiError('Expected JSON response but received non-JSON payload', response.status);
  }

  const payload = (await response.json()) as StandardResponse<T>;

  if (!payload.success) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || `Request failed with status ${payload.status || response.status}`;
    throw new ApiError(message, payload.status || response.status);
  }

  if (typeof payload.data === 'undefined') {
    throw new ApiError('Response payload missing data', payload.status || response.status || 500);
  }

  return payload.data;
}

export async function apiRaw(path: string, options: ApiOptions = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: buildHeaders(options),
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Request failed with status ${response.status}`, response.status);
  }

  return response;
}
