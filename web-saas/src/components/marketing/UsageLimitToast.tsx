'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'spokio.usage_limit.toast';
const DEFAULT_MESSAGE = 'You have exceeded your monthly usage limit for your current plan. Please upgrade to continue.';
const USAGE_LIMIT_EVENT = 'spokio:usage-limit-toast';

export function UsageLimitToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const fromQuery = useMemo(() => {
    const reason = searchParams.get('upgrade_reason');
    if (reason !== 'usage_limit') return '';
    const upgradeMessage = searchParams.get('upgrade_message');
    return upgradeMessage || DEFAULT_MESSAGE;
  }, [searchParams]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const nextMessage = customEvent.detail?.message || DEFAULT_MESSAGE;
      setMessage(nextMessage);
      setVisible(true);
    };

    window.addEventListener(USAGE_LIMIT_EVENT, handler as EventListener);
    return () => window.removeEventListener(USAGE_LIMIT_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    let resolvedMessage = fromQuery;

    if (!resolvedMessage) {
      try {
        resolvedMessage = window.sessionStorage.getItem(STORAGE_KEY) || '';
      } catch {
        resolvedMessage = '';
      }
    }

    if (!resolvedMessage) return;

    setMessage(resolvedMessage);
    setVisible(true);

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-blocking storage failure.
    }

    if (fromQuery) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('upgrade_reason');
      nextParams.delete('upgrade_message');
      const nextUrl = `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`;
      router.replace(nextUrl, { scroll: false });
    }
  }, [fromQuery, pathname, router, searchParams]);

  useEffect(() => {
    if (!visible) return;

    const timeout = window.setTimeout(() => setVisible(false), 5500);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!visible || !message) return null;

  return (
    <div className="fixed right-4 top-20 z-[70] max-w-sm rounded-xl border border-violet-300/60 bg-white px-4 py-3 shadow-2xl shadow-violet-500/25 dark:border-violet-500/40 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-violet-600 dark:text-violet-300">info</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Usage Limit Reached</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          onClick={() => setVisible(false)}
          aria-label="Dismiss usage limit notice"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
