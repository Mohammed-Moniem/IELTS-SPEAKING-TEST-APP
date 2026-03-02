'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';
import { type FieldErrors, validateForgotPassword, isValid } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const marketingVariant = useMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const fe = validateForgotPassword(email);
    setFieldErrors(fe);
    if (!isValid(fe)) return;
    setIsSubmitting(true);

    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        authOptional: true,
        retryOnUnauthorized: false,
        body: JSON.stringify({ email })
      });
      setSuccess(true);
    } catch (err) {
      // Always show success to prevent email enumeration, but log for debugging
      if (err instanceof ApiError && err.status >= 500) {
        setError('Something went wrong. Please try again later.');
      } else {
        setSuccess(true);
      }
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
            badge={{ icon: 'lock_reset', text: 'Recovery' }}
            title="Password reset requested"
            description="Check your inbox for the secure password reset link."
          />
        ) : null}
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 mx-auto">
              <span className="material-symbols-outlined text-[32px] text-emerald-600 dark:text-emerald-400">mark_email_read</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Check Your Email</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If an account exists for <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span>,
                you&apos;ll receive a password reset link shortly.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back to Login
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
          badge={{ icon: 'lock_reset', text: 'Recovery' }}
          title="Forgot your password?"
          description="Enter your account email and we will send a secure reset link."
        />
      ) : null}
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot Password</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</span>
              <input
                className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.email ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setFieldErrors(fe => { const { email: _, ...rest } = fe; return rest; }); }}
                required
                autoFocus
              />
              {fieldErrors.email ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</span> : null}
            </label>
            <button
              className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          {error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : null}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Remember your password?{' '}
            <Link href="/login" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
