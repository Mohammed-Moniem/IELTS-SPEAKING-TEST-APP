'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { apiRequest, ApiError } from '@/lib/api/client';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid or missing verification link.');
      return;
    }

    void (async () => {
      try {
        await apiRequest('/auth/verify-email', {
          method: 'POST',
          authOptional: true,
          retryOnUnauthorized: false,
          body: JSON.stringify({ token })
        });
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Verification failed. The link may have expired.'
        );
      }
    })();
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 mx-auto">
            <span className="material-symbols-outlined text-[32px] text-violet-600 dark:text-violet-400 animate-spin">progress_activity</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verifying Email</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we verify your email address...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 mx-auto">
            <span className="material-symbols-outlined text-[32px] text-emerald-600 dark:text-emerald-400">verified</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Email Verified</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your email address has been verified. You&apos;re all set!
            </p>
          </div>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md w-full">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 mx-auto">
          <span className="material-symbols-outlined text-[32px] text-red-500 dark:text-red-400">error</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verification Failed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
        </div>
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Go to Settings
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4 shadow-sm animate-pulse">
            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Verifying...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
