'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { AdminShell } from '@/components/layout/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const allowedAdminRoles = useMemo(() => {
    if (pathname.startsWith('/admin/content')) return ['superadmin', 'content_manager'];
    if (pathname.startsWith('/admin/users') || pathname.startsWith('/admin/subscriptions')) {
      return ['superadmin', 'support_agent'];
    }
    if (
      pathname.startsWith('/admin/flags') ||
      pathname.startsWith('/admin/ai-cost') ||
      pathname.startsWith('/admin/partners') ||
      pathname.startsWith('/admin/notifications')
    ) {
      return ['superadmin'];
    }
    return ['superadmin', 'content_manager', 'support_agent'];
  }, [pathname]);

  return (
    <RequireAuth requireAdmin allowedAdminRoles={allowedAdminRoles}>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
