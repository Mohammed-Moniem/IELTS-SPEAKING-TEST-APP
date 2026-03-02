'use client';

import { useEffect } from 'react';

import { MARKETING_VARIANT_QUERY_PARAM } from '@/lib/marketing/variant';

export function MarketingVariantQueryCleaner() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(MARKETING_VARIANT_QUERY_PARAM)) {
      return;
    }

    url.searchParams.delete(MARKETING_VARIANT_QUERY_PARAM);
    const search = url.searchParams.toString();
    const cleanPath = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;

    window.history.replaceState(window.history.state, '', cleanPath);
  }, []);

  return null;
}
