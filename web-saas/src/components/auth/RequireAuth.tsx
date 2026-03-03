'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user, appConfig, sessionError, clearSessionError } = useAuth();
  const userRoles = user?.adminRoles || [];
  const hasAllowedAdminRole =
    !allowedAdminRoles?.length || userRoles.some(role => allowedAdminRoles.includes(role));

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Redirecting...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You need to sign in to access this area. Sending you to the home page.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
            href="/"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (requireAdmin && !hasAdminRole(user?.adminRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin role required</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your account does not currently have an admin role assignment for this section.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            href="/app/dashboard"
          >
            Return to Learner Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (requireAdmin && !hasAllowedAdminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Insufficient admin permissions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your account role does not have access to this admin section.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              href="/admin/overview"
            >
              Go to Admin Overview
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              href="/app/dashboard"
            >
              Return to Learner Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isFlagEnabledForPath(pathname || '', appConfig?.featureFlags)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Module not enabled</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This area is currently behind a feature flag for your cohort.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            href="/app/dashboard"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session issue detected</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{sessionError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
              href={`/login?next=${encodeURIComponent(pathname || '/app/dashboard')}`}
            >
              Sign in again
            </Link>
            <button
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={clearSessionError}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
