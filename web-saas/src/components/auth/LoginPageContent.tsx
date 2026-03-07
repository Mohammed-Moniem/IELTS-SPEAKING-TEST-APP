'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { HardNavigationLink } from '@/components/navigation/HardNavigationLink';
import { ApiError } from '@/lib/api/client';
import { type FieldErrors, validateLogin, isValid } from '@/lib/validation';

type LoginPageContentProps = {
  nextParam?: string;
};

export function LoginPageContent({ nextParam = '' }: LoginPageContentProps) {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = nextParam || '/app/dashboard';
  const isAdvertiserIntent = nextParam.includes('/advertise');

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
    <div className="mx-auto max-w-md w-full">
      {isAdvertiserIntent ? (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-5 py-3 mb-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[20px]">campaign</span>
          <p className="text-sm text-violet-700 dark:text-violet-300">Sign in to continue to Spokio advertiser checkout.</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign In</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use your Spokio account to continue to learner and admin SaaS areas.</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Email
            </label>
            <input id="login-email" className={`rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.email ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`} type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(fe => { const { email: _, ...rest } = fe; return rest; }); }} required />
            {fieldErrors.email ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</span> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Password
              </label>
              <HardNavigationLink href="/forgot-password" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Forgot password?</HardNavigationLink>
            </div>
            <div className="relative">
              <input
                id="login-password"
                className={`w-full rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 pr-11 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.password ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(fe => { const { password: _, ...rest } = fe; return rest; }); }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {fieldErrors.password ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</span> : null}
          </div>
          <button className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
        {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No account yet? <HardNavigationLink href={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : '/register'} className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Create one now</HardNavigationLink>
        </p>
      </div>
    </div>
  );
}
