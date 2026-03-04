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

// Routes that are disabled (feature not yet launched) – redirect to dashboard
const DISABLED_APP_ROUTES = ['/app/achievements', '/app/leaderboard', '/app/rewards'];

export function middleware(request: NextRequest) {
  // Block disabled app routes – redirect to dashboard
  const { pathname } = request.nextUrl;
  if (DISABLED_APP_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/dashboard';
    return NextResponse.redirect(url);
  }

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
  matcher: ['/', '/pricing', '/register', '/app/achievements/:path*', '/app/leaderboard/:path*', '/app/rewards/:path*']
};
