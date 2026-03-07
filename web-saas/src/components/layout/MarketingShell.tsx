'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { HardNavigationLink } from '@/components/navigation/HardNavigationLink';

const links = [
  { href: '/', label: 'Home' },
  { href: '/ielts', label: 'Guides' },
  { href: '/blog', label: 'Blog' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

const footerColumns = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/guarantee', label: 'Guarantee' },
      { href: '/methodology', label: 'Methodology' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { href: '/ielts', label: 'IELTS Guides' },
      { href: '/blog', label: 'Blog' },
      { href: '/editorial-policy', label: 'Editorial Policy' },
      { href: '/contact?section=faq', label: 'FAQ' }
    ]
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/advertise', label: 'Advertise' }
    ]
  }
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileNavOpen(false);
      }
    };

    closeOnDesktop(mediaQuery);
    mediaQuery.addEventListener('change', closeOnDesktop);

    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  const navLinkClasses = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 shadow-sm'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  const renderNavLinks = (onNavigate?: () => void) =>
    links.map(item => {
      const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

      return (
        <Link
          key={item.href}
          href={item.href}
          className={navLinkClasses(active)}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <Link href="/" className="group flex items-center gap-2 shrink-0 transition-transform hover:scale-105 active:scale-95 duration-300">
            <BrandLogo className="w-[132px] sm:w-[148px] md:w-[162px]" priority />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {renderNavLinks()}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/app/dashboard">
                  Open App
                </Link>
              ) : (
                <>
                  <HardNavigationLink className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/login">
                    Login
                  </HardNavigationLink>
                  <HardNavigationLink className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/register">
                    Start Free
                  </HardNavigationLink>
                </>
              )}
            </div>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={isMobileNavOpen}
              aria-controls="marketing-mobile-navigation"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 md:hidden ${isMobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setIsMobileNavOpen(false)}
          className="absolute inset-0 bg-gray-950/50 backdrop-blur-[1px]"
        />

        <div
          id="marketing-mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={`relative ml-auto flex h-full w-[min(340px,calc(100%-1rem))] flex-col border-l border-gray-200 bg-white p-5 shadow-2xl transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 ${isMobileNavOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link href="/" className="group flex items-center gap-2" onClick={() => setIsMobileNavOpen(false)}>
              <BrandLogo className="w-[144px]" />
            </Link>

            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Primary">
            {renderNavLinks(() => setIsMobileNavOpen(false))}
          </nav>

          <div className="mt-auto space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            {isAuthenticated ? (
              <Link
                className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                href="/app/dashboard"
                onClick={() => setIsMobileNavOpen(false)}
              >
                Open App
              </Link>
            ) : (
              <>
                <HardNavigationLink
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  href="/login"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  Login
                </HardNavigationLink>
                <HardNavigationLink
                  className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25"
                  href="/register"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  Start Free
                </HardNavigationLink>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200/80 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-block">
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">Spokio</span>
              </Link>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
                The complete IELTS preparation platform for measurable band score improvement.
              </p>
            </div>

            {/* Link columns */}
            {footerColumns.map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">{col.title}</h4>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} Spokio. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/editorial-policy" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                Editorial Policy
              </Link>
              <Link href="/contact" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
