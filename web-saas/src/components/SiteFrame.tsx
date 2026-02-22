import Link from 'next/link';
import { ReactNode } from 'react';

type SiteFrameProps = {
  children: ReactNode;
};

const marketingLinks = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

const productLinks = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/speaking', label: 'Speaking' },
  { href: '/app/writing', label: 'Writing' },
  { href: '/app/reading', label: 'Reading' },
  { href: '/app/listening', label: 'Listening' },
  { href: '/admin/overview', label: 'Admin' }
];

export function SiteFrame({ children }: SiteFrameProps) {
  return (
    <div className="root-shell">
      <header className="top-nav">
        <div className="brand">Spokio Web SaaS</div>
        <nav>
          {marketingLinks.map(item => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <nav>
          {productLinks.map(item => (
            <Link key={item.href} href={item.href} className="nav-link nav-link-product">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="content-shell">{children}</main>
    </div>
  );
}
