'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { RegisterMotionSide } from '@/components/marketing/RegisterMotionSide';
import { marketingEvents } from '@/lib/analytics/marketingEvents';
import { ApiError } from '@/lib/api/client';
import { useMarketingVariant } from '@/lib/marketing/useMarketingVariant';
import { type FieldErrors, validateRegister, isValid } from '@/lib/validation';

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const marketingVariant = useMarketingVariant();
  const isMotionVariant = marketingVariant === 'motion';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearField = (field: string) => setFieldErrors(prev => { const { [field]: _, ...rest } = prev; return rest; });

  const prefilledCodes = useMemo(
    () => ({
      referralCode: searchParams.get('ref') || searchParams.get('referral') || '',
      partnerCode: searchParams.get('partner') || ''
    }),
    [searchParams]
  );

  useEffect(() => {
    if (prefilledCodes.referralCode && !referralCode) {
      setReferralCode(prefilledCodes.referralCode.toUpperCase());
    }
    if (prefilledCodes.partnerCode && !partnerCode) {
      setPartnerCode(prefilledCodes.partnerCode.toUpperCase());
    }
  }, [prefilledCodes, partnerCode, referralCode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const fe = validateRegister({ firstName, lastName, email, password });
    setFieldErrors(fe);
    if (!isValid(fe)) return;
    setIsSubmitting(true);
    marketingEvents.registerSubmitStart({
      route: '/register',
      variant: marketingVariant
    });

    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        phone: phone || undefined,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
        partnerCode: partnerCode.trim() ? partnerCode.trim().toUpperCase() : undefined
      });
      marketingEvents.registerSubmitSuccess({
        route: '/register',
        variant: marketingVariant
      });
      router.replace('/app/dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      setError(message);
      marketingEvents.registerSubmitError({
        route: '/register',
        variant: marketingVariant,
        errorCode: err instanceof ApiError ? `${err.status}` : 'unknown'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl w-full grid gap-8 lg:grid-cols-[1fr_380px] items-start">
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Your Account</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Email/password auth only. Your progress and subscriptions sync across web + mobile.</p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">First Name</span>
                <input className={`motion-input-field rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.firstName ? 'border-red-400 dark:border-red-500 motion-error-shake' : 'border-gray-200 dark:border-gray-700'}`} value={firstName} onChange={e => { setFirstName(e.target.value); clearField('firstName'); }} required />
                {fieldErrors.firstName ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.firstName}</span> : null}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Name</span>
                <input className={`motion-input-field rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.lastName ? 'border-red-400 dark:border-red-500 motion-error-shake' : 'border-gray-200 dark:border-gray-700'}`} value={lastName} onChange={e => { setLastName(e.target.value); clearField('lastName'); }} required />
                {fieldErrors.lastName ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.lastName}</span> : null}
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</span>
              <input className={`motion-input-field rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.email ? 'border-red-400 dark:border-red-500 motion-error-shake' : 'border-gray-200 dark:border-gray-700'}`} type="email" value={email} onChange={e => { setEmail(e.target.value); clearField('email'); }} required />
              {fieldErrors.email ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Password</span>
              <input
                className={`motion-input-field rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${fieldErrors.password ? 'border-red-400 dark:border-red-500 motion-error-shake' : 'border-gray-200 dark:border-gray-700'}`}
                type="password"
                placeholder="At least 8 chars with upper/lower/number/special"
                value={password}
                onChange={e => { setPassword(e.target.value); clearField('password'); }}
                required
                minLength={8}
              />
              {fieldErrors.password ? <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone (Optional)</span>
              <input className="motion-input-field rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Referral Code (Optional)</span>
                <input
                  className="motion-input-field rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="FRIEND2026"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Partner Code (Optional)</span>
                <input
                  className="motion-input-field rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={partnerCode}
                  onChange={e => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder="INFLUENCER01"
                />
              </label>
            </div>
            <button className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Already registered? <Link href="/login" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Login instead</Link>
          </p>
        </div>
      </div>
      {isMotionVariant ? <RegisterMotionSide /> : null}
    </div>
  );
}

function RegisterPageFallback() {
  return (
    <div className="mx-auto max-w-md w-full">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4 shadow-sm animate-pulse">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Preparing registration...</p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
