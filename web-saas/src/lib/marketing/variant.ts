export type MarketingMotionVariant = 'control' | 'motion';

export const MARKETING_VARIANT_COOKIE_NAME = 'spokio_mkt_motion_v1';
export const MARKETING_VARIANT_QUERY_PARAM = 'mkt_variant';
export const MARKETING_VARIANT_REQUEST_HEADER = 'x-spokio-mkt-motion-variant';
export const MARKETING_VARIANT_AUDIENCE = 'individual_learner';

const MARKETING_STATIC_ROUTES = new Set([
  '/',
  '/about',
  '/advertise',
  '/blog',
  '/contact',
  '/editorial-policy',
  '/features',
  '/forgot-password',
  '/guarantee',
  '/ielts',
  '/login',
  '/methodology',
  '/pricing',
  '/register',
  '/reset-password',
  '/verify-email'
]);
const MARKETING_DYNAMIC_ROUTE_PREFIXES = ['/blog/', '/ielts/'];
const FALLBACK_VARIANT: MarketingMotionVariant = 'control';

export function normalizeMarketingVariant(
  value: string | null | undefined
): MarketingMotionVariant | null {
  if (!value) return null;
  if (value === 'control' || value === 'motion') return value;
  return null;
}

export function isMarketingExperimentPath(pathname: string): boolean {
  if (!pathname) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (MARKETING_STATIC_ROUTES.has(normalized)) {
    return true;
  }

  return MARKETING_DYNAMIC_ROUTE_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function getMarketingVariantOverride(
  searchParams: URLSearchParams
): MarketingMotionVariant | null {
  return normalizeMarketingVariant(searchParams.get(MARKETING_VARIANT_QUERY_PARAM));
}

export function getMarketingMotionEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_GROWTH_MARKETING_MOTION_V1 || 'false') === 'true';
}

export function getMarketingMotionTrafficPercent(): number {
  const parsed = Number(process.env.NEXT_PUBLIC_GROWTH_MARKETING_MOTION_TRAFFIC_PERCENT || '0');
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

export function chooseMarketingVariant(key: string, trafficPercent: number): MarketingMotionVariant {
  if (trafficPercent <= 0) return 'control';
  if (trafficPercent >= 100) return 'motion';

  const bucket = hashString(key) % 100;
  return bucket < trafficPercent ? 'motion' : 'control';
}

export function resolveMarketingVariantFromIdentity(identity: string): MarketingMotionVariant {
  if (!getMarketingMotionEnabled()) return FALLBACK_VARIANT;
  return chooseMarketingVariant(identity, getMarketingMotionTrafficPercent());
}

export function getClientMarketingVariantFromCookies(cookieString: string): MarketingMotionVariant {
  const pattern = new RegExp(`(?:^|;\\s*)${MARKETING_VARIANT_COOKIE_NAME}=([^;]+)`);
  const match = cookieString.match(pattern);
  const decoded = match?.[1] ? decodeURIComponent(match[1]) : null;
  return normalizeMarketingVariant(decoded) || FALLBACK_VARIANT;
}
