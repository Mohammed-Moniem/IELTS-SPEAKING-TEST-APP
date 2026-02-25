'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError } from '@/lib/api/client';

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

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
      router.replace('/app/dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-card panel stack">
      <h1>Create your account</h1>
      <p className="subtitle">Email/password auth only. Your progress and subscriptions sync across web + mobile.</p>
      <form className="stack" onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="stack">
            <span>First name</span>
            <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </label>
          <label className="stack">
            <span>Last name</span>
            <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </label>
        </div>
        <label className="stack">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="stack">
          <span>Password</span>
          <input
            className="input"
            type="password"
            placeholder="At least 8 chars with upper/lower/number/special"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="stack">
          <span>Phone (optional)</span>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="stack">
            <span>Referral code (optional)</span>
            <input
              className="input"
              value={referralCode}
              onChange={e => setReferralCode(e.target.value.toUpperCase())}
              placeholder="FRIEND2026"
            />
          </label>
          <label className="stack">
            <span>Partner code (optional)</span>
            <input
              className="input"
              value={partnerCode}
              onChange={e => setPartnerCode(e.target.value.toUpperCase())}
              placeholder="INFLUENCER01"
            />
          </label>
        </div>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <p className="small">
        Already registered? <Link href="/login">Login instead</Link>
      </p>
    </section>
  );
}

function RegisterPageFallback() {
  return (
    <section className="auth-card panel stack">
      <h1>Create your account</h1>
      <p className="subtitle">Preparing registration...</p>
    </section>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
