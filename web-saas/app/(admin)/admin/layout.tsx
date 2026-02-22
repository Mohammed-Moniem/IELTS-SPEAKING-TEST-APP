'use client';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { AdminShell } from '@/components/layout/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requireAdmin>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
