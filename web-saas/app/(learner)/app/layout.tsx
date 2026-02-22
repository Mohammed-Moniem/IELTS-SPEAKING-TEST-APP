'use client';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { LearnerShell } from '@/components/layout/LearnerShell';

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <LearnerShell>{children}</LearnerShell>
    </RequireAuth>
  );
}
