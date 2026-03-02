import { cookies, headers } from 'next/headers';

import {
  MARKETING_VARIANT_COOKIE_NAME,
  MARKETING_VARIANT_REQUEST_HEADER,
  normalizeMarketingVariant,
  type MarketingMotionVariant
} from '@/lib/marketing/variant';

export async function getServerMarketingVariant(): Promise<MarketingMotionVariant> {
  const headerStore = await headers();
  const headerVariant = normalizeMarketingVariant(
    headerStore.get(MARKETING_VARIANT_REQUEST_HEADER)
  );
  if (headerVariant) {
    return headerVariant;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(MARKETING_VARIANT_COOKIE_NAME)?.value;
  return normalizeMarketingVariant(value) || 'control';
}
