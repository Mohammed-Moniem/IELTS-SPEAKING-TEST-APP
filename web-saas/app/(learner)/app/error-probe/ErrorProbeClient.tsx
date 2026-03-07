'use client';

import { useEffect, useState } from 'react';

export default function ErrorProbeClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return null;
  }

  const navigationEntry = window.performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigationEntry?.type !== 'reload') {
    throw new Error(`Error probe expected a hard reload, got ${navigationEntry?.type || 'navigate'}.`);
  }

  return (
    <section className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Recovery Confirmed</span>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Reload recovery confirmed</h1>
      <p className="max-w-xl text-sm text-slate-600">
        This route only becomes healthy after the browser performs a full page reload.
      </p>
    </section>
  );
}
