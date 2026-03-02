'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AdminOverviewView } from '@/lib/types';

const operationsLinks = [
  { href: '/admin/overview', label: 'Overview', icon: 'dashboard' },
  { href: '/admin/content', label: 'Content', icon: 'edit_note' },
  { href: '/admin/content/blog', label: 'Blog Ops', icon: 'article' },
  { href: '/admin/users', label: 'Users', icon: 'group' },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: 'credit_card' },
  { href: '/admin/notifications', label: 'Campaigns', icon: 'campaign' },
  { href: '/admin/partners', label: 'Partners', icon: 'handshake' },
  { href: '/admin/ads', label: 'Ads', icon: 'ads_click' }
];

const intelligenceLinks = [
  { href: '/admin/analytics', label: 'Analytics', icon: 'monitoring' },
  { href: '/admin/ai-cost', label: 'AI Cost', icon: 'psychology' },
  { href: '/admin/flags', label: 'Flags', icon: 'flag' }
];

const subscriptionSearchKeywords = [
  'subscription',
  'subscriptions',
  'billing',
  'invoice',
  'payment',
  'plan',
  'renewal',
  'past due',
  'past_due'
];

const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isObjectIdLike = (value: string) => /^[a-f0-9]{24}$/i.test(value);

const severityStyles: Record<AdminOverviewView['alerts'][number]['severity'], string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  info: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const roles = user?.adminRoles || [];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [bellError, setBellError] = useState('');
  const [bellAlerts, setBellAlerts] = useState<AdminOverviewView['alerts']>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const visibleOperations = operationsLinks.filter(item => {
    if (item.href === '/admin/content' || item.href === '/admin/content/blog') {
      return roles.includes('superadmin') || roles.includes('content_manager');
    }
    if (item.href === '/admin/users' || item.href === '/admin/subscriptions') {
      return roles.includes('superadmin') || roles.includes('support_agent');
    }
    if (item.href === '/admin/notifications' || item.href === '/admin/partners' || item.href === '/admin/ads') {
      return roles.includes('superadmin');
    }
    return true;
  });

  const visibleIntelligence = intelligenceLinks.filter(item => {
    if (item.href === '/admin/analytics' || item.href === '/admin/ai-cost') {
      return roles.includes('superadmin') || roles.includes('content_manager');
    }
    if (item.href === '/admin/flags') return roles.includes('superadmin');
    return true;
  });

  const allLinks = [...visibleOperations, ...visibleIntelligence];
  const initials = user?.firstName?.[0]?.toUpperCase() || 'A';

  const routeSearchIndex = useMemo(
    () =>
      allLinks.map(item => ({
        href: item.href,
        label: item.label.toLowerCase(),
        slug: item.href.split('/').filter(Boolean).join(' ')
      })),
    [allLinks]
  );

  const loadBellFeed = async () => {
    setBellLoading(true);
    setBellError('');
    try {
      const payload = await webApi.getAdminOverviewView({ window: '24h' });
      const alerts = payload.alerts.slice(0, 10);
      setBellAlerts(alerts);
      setUnreadCount(alerts.length);
    } catch (err) {
      setBellError(err instanceof ApiError ? err.message : 'Failed to load alerts');
    } finally {
      setBellLoading(false);
    }
  };

  const runSearch = () => {
    const query = searchValue.trim();
    if (!query) return;

    setSearchError('');
    const normalized = query.toLowerCase();
    const routeMatch = routeSearchIndex.find(
      item =>
        item.label.includes(normalized) ||
        item.slug.includes(normalized) ||
        normalized.includes(item.label) ||
        normalized.includes(item.slug)
    );

    if (routeMatch) {
      router.push(routeMatch.href);
      return;
    }

    if (subscriptionSearchKeywords.some(keyword => normalized.includes(keyword))) {
      router.push(`/admin/subscriptions?query=${encodeURIComponent(query)}`);
      return;
    }

    if (isEmailLike(query) || isObjectIdLike(query)) {
      router.push(`/admin/users?query=${encodeURIComponent(query)}`);
      return;
    }

    router.push(`/admin/users?query=${encodeURIComponent(query)}`);
  };

  useEffect(() => {
    if (!bellOpen) return;

    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (bellRef.current && target && !bellRef.current.contains(target)) {
        setBellOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [bellOpen]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 lg:px-10 h-16 shadow-sm">
        <div className="flex items-center gap-8">
          <Link href="/admin/overview" className="group flex items-center gap-3 flex-shrink-0 transition-transform hover:scale-105 active:scale-95 duration-300">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-colors">
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-xl group-hover:animate-float group-hover:rotate-12 transition-transform duration-500">hub</span>
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight group-hover:from-indigo-600 group-hover:to-violet-600 dark:group-hover:from-indigo-400 dark:group-hover:to-violet-400 transition-all duration-300">Spokio Admin</span>
          </Link>

          <div className="hidden md:flex items-center w-72 h-10 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <span className="material-symbols-outlined text-slate-400 text-[20px] pl-3">search</span>
            <input
              type="text"
              value={searchValue}
              placeholder="Search routes, user email, or id..."
              className="flex-1 bg-transparent border-none outline-none px-3 text-sm text-gray-900 dark:text-white placeholder:text-slate-400"
              onChange={event => {
                setSearchValue(event.target.value);
                if (searchError) setSearchError('');
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runSearch();
                }
                if (event.key === 'Escape') {
                  setSearchValue('');
                  setSearchError('');
                }
              }}
            />
          </div>
          {searchError ? <p className="hidden lg:block text-xs text-red-600 dark:text-red-400">{searchError}</p> : null}
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden xl:flex items-center gap-1">
            {allLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${isActive(item.href)
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10'
                    : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/app/dashboard"
              className="hidden sm:inline-flex text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 transition-colors"
            >
              Learner App
            </Link>
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                className="relative w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center justify-center text-slate-500 transition-colors"
                onClick={() => {
                  const next = !bellOpen;
                  setBellOpen(next);
                  if (next) void loadBellFeed();
                }}
                aria-label="Open system alerts"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 ? (
                  <span className="absolute top-1 right-1 min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px] text-center">
                    {Math.min(99, unreadCount)}
                  </span>
                ) : null}
              </button>

              {bellOpen ? (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 space-y-2 z-30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">System Alerts</h3>
                    <button
                      type="button"
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                      onClick={() => void loadBellFeed()}
                      disabled={bellLoading}
                    >
                      Refresh
                    </button>
                  </div>
                  {bellLoading ? <p className="text-xs text-gray-500 dark:text-gray-400">Loading alerts...</p> : null}
                  {bellError ? <p className="text-xs text-red-600 dark:text-red-400">{bellError}</p> : null}
                  {!bellLoading && !bellError && bellAlerts.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No recent system alerts.</p>
                  ) : null}
                  {!bellLoading && !bellError && bellAlerts.length > 0 ? (
                    <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                      {bellAlerts.map(alert => {
                        const params = new URLSearchParams();
                        params.set('auditAction', alert.action);
                        if (alert.targetId) params.set('query', alert.targetId);
                        params.set('dateFrom', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
                        return (
                          <li key={alert.id}>
                            <Link
                              href={`/admin/users?${params.toString()}`}
                              className="block rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                              onClick={() => setBellOpen(false)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${severityStyles[alert.severity]}`}>
                                  {alert.severity.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {new Date(alert.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-gray-900 dark:text-white">{alert.action}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">{alert.targetType}</p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => void logout()}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all"
              title={`${user?.firstName || 'Admin'} — Click to logout`}
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <div className="xl:hidden overflow-x-auto border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4">
        <nav className="flex items-center gap-1 py-2">
          {allLinks.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${isActive(item.href)
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10'
                  : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-6 lg:p-10">{children}</main>
    </div>
  );
}
