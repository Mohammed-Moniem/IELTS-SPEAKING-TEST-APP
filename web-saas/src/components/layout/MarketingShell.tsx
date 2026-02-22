'use client';

import Link from 'next/link';

import { useAuth } from '@/components/auth/AuthProvider';

const links = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="section-wrap" style={{ minHeight: '100vh' }}>
      <header className="top-strip" style={{ margin: '1rem', position: 'sticky', top: '0.9rem', zIndex: 10 }}>
        <div className="shell-logo">Spokio</div>
        <nav>
          {links.map(item => (
            <Link key={item.href} href={item.href} className="shell-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="cta-row" style={{ marginLeft: 'auto' }}>
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
      <main style={{ maxWidth: 1160, margin: '0 auto', padding: '0.2rem 1rem 2.4rem', width: '100%' }}>{children}</main>
    </div>
  );
}
