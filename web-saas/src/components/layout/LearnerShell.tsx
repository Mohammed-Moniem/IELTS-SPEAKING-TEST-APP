'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ThemeToggle } from './ThemeToggle';

const practiceLinks = [
  { href: '/app/speaking', label: 'Speaking', icon: 'record_voice_over' },
  { href: '/app/writing', label: 'Writing', icon: 'edit_note' },
  { href: '/app/reading', label: 'Reading', icon: 'auto_stories' },
  { href: '/app/listening', label: 'Listening', icon: 'headphones' }
];

const assessmentLinks = [
  { href: '/app/tests', label: 'Full Exams', icon: 'quiz' },
  { href: '/app/progress', label: 'Progress & Stats', icon: 'monitoring' },
  { href: '/app/study-plan', label: 'Study Plan', icon: 'route' }
];

const libraryLinks = [
  { href: '/app/library/collocations', label: 'Collocations', icon: 'dictionary' },
  { href: '/app/library/vocabulary', label: 'Vocabulary', icon: 'menu_book' }
];

const accountLinks = [
  { href: '/app/billing', label: 'Billing & Plan', icon: 'credit_card' },
  { href: '/app/settings', label: 'Settings', icon: 'settings' }
];

const rewardsLinks = [
  { href: '/app/achievements', label: 'Achievements', icon: 'emoji_events' },
  { href: '/app/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { href: '/app/rewards', label: 'Points & Rewards', icon: 'loyalty' }
];

export function LearnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, appConfig } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const visiblePracticeLinks = practiceLinks.filter(item => {
    if (item.href === '/app/writing') return appConfig?.featureFlags?.writing_module?.enabled ?? true;
    if (item.href === '/app/reading') return appConfig?.featureFlags?.reading_module?.enabled ?? true;
    if (item.href === '/app/listening') return appConfig?.featureFlags?.listening_module?.enabled ?? true;
    return true;
  });

  const visibleAssessmentLinks = assessmentLinks.filter(item => {
    if (item.href === '/app/tests') return appConfig?.featureFlags?.full_exam_module?.enabled ?? true;
    return true;
  });

  const visibleAccountLinks = (() => {
    const links = [...accountLinks];
    if (appConfig?.partnerPortal?.isPartner) {
      links.push({ href: '/app/partner', label: 'Partner Portal', icon: 'handshake' });
    }
    if (appConfig?.advertiserPortal?.isAdvertiser) {
      links.push({ href: '/app/advertiser', label: 'Advertiser Portal', icon: 'campaign' });
    }
    return links;
  })();

  const initials =
    `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const sections = useMemo(
    () => [
      { title: null, items: [{ href: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' }] },
      { title: 'Practice Areas', items: visiblePracticeLinks },
      { title: 'Assessment', items: visibleAssessmentLinks },
      { title: 'Library', items: libraryLinks },
      { title: 'Account', items: visibleAccountLinks }
    ],
    [visiblePracticeLinks, visibleAssessmentLinks, visibleAccountLinks]
  );

  const currentPageLabel = useMemo(() => {
    const allItems = sections.flatMap(section => section.items);
    return allItems.find(item => isActive(item.href))?.label || 'Learner App';
  }, [sections, pathname]);

  const navLinkClasses = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(href)
      ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
    }`;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileNavOpen(false);
      }
    };

    closeOnDesktop(mediaQuery);
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  const handleLogout = () => {
    setIsMobileNavOpen(false);
    void logout();
  };

  const renderNavLinks = () =>
    sections.map(section => (
      <div key={section.title || 'dashboard'} className={section.title ? 'mb-6' : 'mb-0'}>
        {section.title ? (
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {section.title}
          </p>
        ) : null}
        <nav className="flex flex-col gap-1">
          {section.items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClasses(item.href)}
              onClick={() => setIsMobileNavOpen(false)}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    ));

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 left-0 z-20 hidden h-screen w-[264px] flex-col overflow-y-auto border-r border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:flex">
        {/* Logo */}
        <Link href="/app/dashboard" className="group mb-8 inline-flex transition-transform hover:scale-[1.02] active:scale-[0.99] duration-300">
          <BrandLogo className="w-[138px]" priority />
        </Link>

        {renderNavLinks()}

        {/* User profile footer */}
        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.firstName || 'Student'} {user?.lastName || ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={isMobileNavOpen}
            aria-controls="learner-mobile-navigation"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{currentPageLabel}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {user?.firstName || 'Student'} {user?.lastName || ''}
            </p>
          </div>

          <ThemeToggle />
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 lg:hidden ${isMobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setIsMobileNavOpen(false)}
          className="absolute inset-0 bg-gray-950/50 backdrop-blur-[1px]"
        />

        <div
          id="learner-mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Learner navigation"
          className={`relative flex h-full w-[min(320px,calc(100%-2rem))] flex-col border-r border-gray-200 bg-white p-5 shadow-2xl transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link
              href="/app/dashboard"
              className="group inline-flex"
              onClick={() => setIsMobileNavOpen(false)}
            >
              <BrandLogo className="w-[138px]" />
            </Link>

            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {renderNavLinks()}

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {user?.firstName || 'Student'} {user?.lastName || ''}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                aria-label="Logout"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="min-h-screen flex-1 lg:ml-[264px]">
        {/* Desktop top navbar */}
        <header className="sticky top-0 z-10 hidden h-14 items-center justify-end border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 lg:flex">
          <ThemeToggle />
        </header>

        <div className="pt-16 lg:pt-0">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
