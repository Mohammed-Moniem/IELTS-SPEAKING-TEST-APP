'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <Link href="/" className="group flex items-center gap-2 shrink-0 transition-transform hover:scale-105 active:scale-95 duration-300">
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 group-hover:from-violet-500 group-hover:to-fuchsia-500 bg-[length:200%_auto] animate-gradient transition-all duration-300">Spokio</span>
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors duration-300">IELTS SaaS Platform</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(item => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${active ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/app/dashboard">
                Open App
              </Link>
            ) : (
              <>
                <Link className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" href="/login">
                  Login
                </Link>
                <Link className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" href="/register">
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
            <p className="text-xs text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} Spokio. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/editorial-policy" className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Editorial Policy
              </Link>
              <Link href="/contact" className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
