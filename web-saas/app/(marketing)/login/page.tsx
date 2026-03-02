'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { ApiError } from '@/lib/api/client';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';
import { type FieldErrors, validateLogin, isValid } from '@/lib/validation';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const marketingVariant = useMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = searchParams.get('next') || '/app/dashboard';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const fe = validateLogin(email, password);
    setFieldErrors(fe);
    if (!isValid(fe)) return;

    setIsSubmitting(true);

    try {
      await login(email, password);
      router.replace(next);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isMotionVariant ? (
        <MarketingPageHero
          variant="compact"
          animated
          badge={{ icon: 'login', text: 'Welcome Back' }}
          title="Sign in to continue"
          description="Access your learner workspace, progress data, and account settings."
        />
      ) : null}
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign In</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use your Spokio account to continue to learner and admin SaaS areas.</p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</span>
              <input className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.email ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`} type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(fe => { const { email: _, ...rest } = fe; return rest; }); }} required />
              {fieldErrors.email ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Password</span>
                <Link href="/forgot-password" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Forgot password?</Link>
              </div>
              <input
                className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.password ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(fe => { const { password: _, ...rest } = fe; return rest; }); }}
                required
              />
              {fieldErrors.password ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</span> : null}
            </label>
            <button className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
          {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            No account yet? <Link href="/register" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Create one now</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4 shadow-sm animate-pulse">
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading sign-in...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
