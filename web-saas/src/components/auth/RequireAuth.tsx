'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

type RequireAuthProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

const hasAdminRole = (roles: string[] | undefined) =>
  !!roles?.some(role => role === 'superadmin' || role === 'content_manager' || role === 'support_agent');

export function RequireAuth({ children, requireAdmin = false }: RequireAuthProps) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user } = useAuth();

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

  return <>{children}</>;
}
