import { NextRequest, NextResponse } from 'next/server';

import {
  MARKETING_VARIANT_COOKIE_NAME,
  MARKETING_VARIANT_REQUEST_HEADER,
  getMarketingVariantOverride,
  isMarketingExperimentPath,
  normalizeMarketingVariant,
  resolveMarketingVariantFromIdentity
} from './src/lib/marketing/variant';

const MARKETING_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

const withVariantCookie = (
  response: NextResponse,
  request: NextRequest,
  variant: 'control' | 'motion'
) => {
  response.cookies.set({
    name: MARKETING_VARIANT_COOKIE_NAME,
    value: variant,
    path: '/',
    maxAge: MARKETING_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:'
  });
  return response;
};

const buildIdentity = (request: NextRequest): string => {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const language = request.headers.get('accept-language') || '';
  return `${forwardedFor}|${userAgent}|${language}`;
};

export function middleware(request: NextRequest) {
  if (!isMarketingExperimentPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const override = getMarketingVariantOverride(request.nextUrl.searchParams);
  const existingVariant = normalizeMarketingVariant(
    request.cookies.get(MARKETING_VARIANT_COOKIE_NAME)?.value
  );
  const resolvedVariant =
    override ||
    existingVariant ||
    resolveMarketingVariantFromIdentity(buildIdentity(request));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(MARKETING_VARIANT_REQUEST_HEADER, resolvedVariant);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (override || !existingVariant) {
    return withVariantCookie(response, request, resolvedVariant);
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/about',
    '/advertise',
    '/blog',
    '/blog/:path*',
    '/contact',
    '/editorial-policy',
    '/features',
    '/forgot-password',
    '/guarantee',
    '/ielts',
    '/ielts/:path*',
    '/login',
    '/methodology',
    '/pricing',
    '/register',
    '/reset-password',
    '/verify-email'
  ]
};
