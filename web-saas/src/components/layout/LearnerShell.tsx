'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

const links = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/speaking', label: 'Speaking' },
  { href: '/app/writing', label: 'Writing' },
  { href: '/app/reading', label: 'Reading' },
  { href: '/app/listening', label: 'Listening' },
  { href: '/app/tests', label: 'Full Tests' },
  { href: '/app/progress', label: 'Progress' },
  { href: '/app/billing', label: 'Billing' },
  { href: '/app/settings', label: 'Settings' }
];

export function LearnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="stack">
          <p className="shell-logo">Spokio Learner</p>
          <p className="small">Academic + General IELTS prep</p>
        </div>
        <nav className="stack">
          {links.map(item => (
            <Link key={item.href} href={item.href} className="shell-nav-link" data-active={pathname === item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="panel stack" style={{ marginTop: 'auto' }}>
          <p className="small">Signed in as</p>
          <p>{user?.email}</p>
          <span className="tag">Plan: {user?.subscriptionPlan || 'free'}</span>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/admin/overview">
              Admin
            </Link>
            <button className="btn btn-danger" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="shell-main">{children}</main>
    </div>
  );
}
