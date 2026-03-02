'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-500/10 mx-auto">
          <span className="material-symbols-outlined text-[40px] text-red-500 dark:text-red-400">error</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Something Went Wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">Error ID: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Try Again
          </button>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
