'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

const links = [
  { href: '/admin/overview', label: 'Overview' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/ai-cost', label: 'AI Cost' },
  { href: '/admin/flags', label: 'Flags' }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <div className="stack">
          <p className="shell-logo">Spokio Admin</p>
          <p className="small">Content, support, rollout operations</p>
        </div>
        <nav className="stack">
          {links.map(item => (
            <Link key={item.href} href={item.href} className="shell-nav-link" data-active={pathname === item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="panel stack" style={{ marginTop: 'auto' }}>
          <p>{user?.email}</p>
          <p className="small">Roles: {(user?.adminRoles || []).join(', ') || 'none'}</p>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/app/dashboard">
              Learner App
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
