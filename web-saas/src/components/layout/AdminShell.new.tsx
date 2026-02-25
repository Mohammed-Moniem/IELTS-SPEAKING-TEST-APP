'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

const operationsLinks = [
  { href: '/admin/overview', label: 'Overview', icon: 'dashboard' },
  { href: '/admin/content', label: 'Content', icon: 'edit_note' },
  { href: '/admin/users', label: 'Users', icon: 'group' },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: 'credit_card' },
  { href: '/admin/notifications', label: 'Campaigns', icon: 'campaign' },
  { href: '/admin/partners', label: 'Partners', icon: 'handshake' }
];

const intelligenceLinks = [
  { href: '/admin/analytics', label: 'Analytics', icon: 'monitoring' },
  { href: '/admin/ai-cost', label: 'AI Cost', icon: 'psychology' },
  { href: '/admin/flags', label: 'Flags', icon: 'flag' }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const roles = user?.adminRoles || [];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const visibleOperations = operationsLinks.filter(item => {
    if (item.href === '/admin/content') return roles.includes('superadmin') || roles.includes('content_manager');
    if (item.href === '/admin/users' || item.href === '/admin/subscriptions') {
      return roles.includes('superadmin') || roles.includes('support_agent');
    }
    if (item.href === '/admin/notifications' || item.href === '/admin/partners') {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 lg:px-10 h-16 shadow-sm">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/admin/overview" className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-500 text-xl">hub</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Spokio Admin</span>
          </Link>

          {/* Search */}
          <div className="hidden md:flex items-center w-64 h-10 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <span className="material-symbols-outlined text-slate-400 text-[20px] pl-3">search</span>
            <input
              type="text"
              placeholder="Search..."
              className="flex-1 bg-transparent border-none outline-none px-3 text-sm text-gray-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Nav links - horizontal */}
          <nav className="hidden xl:flex items-center gap-1">
            {allLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                  isActive(item.href)
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10'
                    : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/app/dashboard"
              className="hidden sm:inline-flex text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 transition-colors"
            >
              Learner App
            </Link>
            <button className="relative w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center justify-center text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
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

      {/* Mobile nav (xl:hidden) */}
      <div className="xl:hidden overflow-x-auto border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4">
        <nav className="flex items-center gap-1 py-2">
          {allLinks.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                isActive(item.href)
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

      {/* Main content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-6 lg:p-10">
        {children}
      </main>
    </div>
  );
}
