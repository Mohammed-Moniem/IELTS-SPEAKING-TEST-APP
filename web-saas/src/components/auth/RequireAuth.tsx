'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

type RequireAuthProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedAdminRoles?: string[];
};

const hasAdminRole = (roles: string[] | undefined) =>
  !!roles?.some(role => role === 'superadmin' || role === 'content_manager' || role === 'support_agent');

const routeFlagMap: Array<{ pathPrefix: string; flag: string }> = [
  { pathPrefix: '/app/writing', flag: 'writing_module' },
  { pathPrefix: '/app/reading', flag: 'reading_module' },
  { pathPrefix: '/app/listening', flag: 'listening_module' },
  { pathPrefix: '/app/tests', flag: 'full_exam_module' },
  { pathPrefix: '/app/advertiser', flag: 'growth_ads_v1' },
  { pathPrefix: '/admin', flag: 'admin_suite' }
];

const isFlagEnabledForPath = (pathname: string, flags: Record<string, { enabled: boolean }> | undefined) => {
  const match = routeFlagMap.find(item => pathname.startsWith(item.pathPrefix));
  if (!match) return true;
  if (!flags || !flags[match.flag]) return true;
  return flags[match.flag].enabled;
};

export function RequireAuth({ children, requireAdmin = false, allowedAdminRoles }: RequireAuthProps) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user, appConfig, sessionError, clearSessionError } = useAuth();
  const userRoles = user?.adminRoles || [];
  const hasAllowedAdminRole =
    !allowedAdminRoles?.length || userRoles.some(role => allowedAdminRoles.includes(role));

  if (isLoading) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <div className="loader" />
          <p className="small">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ maxWidth: 620 }}>
          <h2>Sign in required</h2>
          <p className="subtitle">This area is part of the learner/admin SaaS experience and requires authentication.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(pathname || '/app/dashboard')}`}>
              Go to Login
            </Link>
            <Link className="btn btn-secondary" href="/register">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (requireAdmin && !hasAdminRole(user?.adminRoles)) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ maxWidth: 620 }}>
          <h2>Admin role required</h2>
          <p className="subtitle">Your account does not currently have an admin role assignment for this section.</p>
          <Link className="btn btn-secondary" href="/app/dashboard">
            Return to Learner Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (requireAdmin && !hasAllowedAdminRole) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ maxWidth: 620 }}>
          <h2>Insufficient admin permissions</h2>
          <p className="subtitle">
            Your account role does not have access to this admin section.
          </p>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/admin/overview">
              Go to Admin Overview
            </Link>
            <Link className="btn btn-secondary" href="/app/dashboard">
              Return to Learner Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isFlagEnabledForPath(pathname || '', appConfig?.featureFlags)) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ maxWidth: 620 }}>
          <h2>Module not enabled</h2>
          <p className="subtitle">This area is currently behind a feature flag for your cohort.</p>
          <Link className="btn btn-secondary" href="/app/dashboard">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="center-empty">
        <div className="panel stack" style={{ maxWidth: 620 }}>
          <h2>Session issue detected</h2>
          <p className="subtitle">{sessionError}</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(pathname || '/app/dashboard')}`}>
              Sign in again
            </Link>
            <button className="btn btn-secondary" onClick={clearSessionError}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
