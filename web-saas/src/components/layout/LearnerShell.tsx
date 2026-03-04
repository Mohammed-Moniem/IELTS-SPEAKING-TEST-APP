'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

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
  { href: '/app/library/vocabulary', label: 'Vocabulary', icon: 'menu_book' },
  { href: '/app/library/books', label: 'Books', icon: 'book_2' },
  { href: '/app/library/channels', label: 'Channels', icon: 'tv' }
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

  const navLinkClasses = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(href)
      ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-[264px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col p-5 overflow-y-auto z-20">
        {/* Logo */}
        <Link href="/app/dashboard" className="group flex items-center gap-3 mb-8 transition-transform hover:scale-105 active:scale-95 duration-300">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600 bg-[length:200%_auto] animate-gradient flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <span className="text-white font-black text-sm group-hover:rotate-12 transition-transform duration-500">S</span>
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight group-hover:from-violet-600 group-hover:to-indigo-600 dark:group-hover:from-violet-400 dark:group-hover:to-indigo-400 transition-all duration-300">Spokio</span>
        </Link>

        {/* Dashboard */}
        <Link href="/app/dashboard" className={navLinkClasses('/app/dashboard')}>
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          Dashboard
        </Link>

        {/* Practice Areas */}
        <div className="mt-6 mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Practice Areas
          </p>
          <nav className="flex flex-col gap-1">
            {visiblePracticeLinks.map(item => (
              <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Assessment */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Assessment
          </p>
          <nav className="flex flex-col gap-1">
            {visibleAssessmentLinks.map(item => (
              <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Library
          </p>
          <nav className="flex flex-col gap-1">
            {libraryLinks.map(item => (
              <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Rewards – hidden until feature is ready
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Rewards
          </p>
          <nav className="flex flex-col gap-1">
            {rewardsLinks.map(item => (
              <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        */}

        {/* Account */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Account
          </p>
          <nav className="flex flex-col gap-1">
            {visibleAccountLinks.map(item => (
              <Link key={item.href} href={item.href} className={navLinkClasses(item.href)}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

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
              onClick={() => void logout()}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[264px] flex-1 min-h-screen">
        <div className="max-w-[1440px] mx-auto p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}


