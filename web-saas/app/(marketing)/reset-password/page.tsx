'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';
import { type FieldErrors, validateResetPassword, isValid } from '@/lib/validation';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const marketingVariant = useMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearField = (field: string) => setFieldErrors(prev => { const { [field]: _, ...rest } = prev; return rest; });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }

    const fe = validateResetPassword(password, confirmPassword);
    setFieldErrors(fe);
    if (!isValid(fe)) return;

    setIsSubmitting(true);

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        authOptional: true,
        retryOnUnauthorized: false,
        body: JSON.stringify({ token, password })
      });
      setSuccess(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to reset password. The link may have expired.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        {isMotionVariant ? (
          <MarketingPageHero
            variant="compact"
            animated
            badge={{ icon: 'password', text: 'Account Recovery' }}
            title="Password updated"
            description="Your account security is restored. Continue to sign in."
          />
        ) : null}
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 mx-auto">
              <span className="material-symbols-outlined text-[32px] text-emerald-600 dark:text-emerald-400">check_circle</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Password Reset</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        {isMotionVariant ? (
          <MarketingPageHero
            variant="compact"
            animated
            badge={{ icon: 'link_off', text: 'Recovery Link' }}
            title="Reset link invalid"
            description="Request a new reset link to continue with account recovery."
          />
        ) : null}
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 mx-auto">
              <span className="material-symbols-outlined text-[32px] text-amber-600 dark:text-amber-400">link_off</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invalid Link</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isMotionVariant ? (
        <MarketingPageHero
          variant="compact"
          animated
          badge={{ icon: 'password', text: 'Account Recovery' }}
          title="Set a new password"
          description="Create a strong password to secure your account and continue learning."
        />
      ) : null}
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset Password</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter your new password below.</p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">New Password</span>
              <input
                className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.password ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); clearField('password'); }}
                required
                minLength={8}
                autoFocus
              />
              {fieldErrors.password ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confirm Password</span>
              <input
                className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.confirmPassword ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); clearField('confirmPassword'); }}
                required
                minLength={8}
              />
              {fieldErrors.confirmPassword ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.confirmPassword}</span> : null}
            </label>
            <button
              className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
          {error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4 shadow-sm animate-pulse">
            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
