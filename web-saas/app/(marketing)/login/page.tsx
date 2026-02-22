'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = searchParams.get('next') || '/app/dashboard';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
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
    <section className="auth-card panel stack">
      <h1>Sign in</h1>
      <p className="subtitle">Use your Spokio account to continue to learner and admin SaaS areas.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="stack">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="stack">
          <span>Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <p className="small">
        No account yet? <Link href="/register">Create one now</Link>
      </p>
    </section>
  );
}
