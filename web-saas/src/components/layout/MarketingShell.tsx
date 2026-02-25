'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const links = [
  { href: '/', label: 'Home' },
  { href: '/ielts', label: 'Guides' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  return (
    <div className="experience experience-marketing">
      <header className="top-strip marketing-header">
        <Link href="/" className="marketing-brand">
          <span className="shell-logo">Spokio</span>
          <span className="small marketing-brand-note">IELTS SaaS Platform</span>
        </Link>
        <nav className="marketing-nav">
          {links.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="shell-nav-link"
              data-active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="cta-row marketing-header-actions">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link className="btn btn-secondary" href="/app/dashboard">
              Open App
            </Link>
          ) : (
            <>
              <Link className="btn btn-secondary" href="/login">
                Login
              </Link>
              <Link className="btn btn-primary" href="/register">
                Start Free
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="marketing-main">{children}</main>
    </div>
  );
}
