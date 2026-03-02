'use client';

import Image from 'next/image';

export function RegisterMotionSide() {
  return (
    <aside
      data-testid="register-motion-side"
      className="hidden lg:block rounded-3xl border border-violet-200/70 dark:border-violet-500/30 bg-white/70 dark:bg-gray-900/70 p-6 shadow-2xl ring-1 ring-violet-200/50 dark:ring-violet-500/20 motion-reveal-visible"
    >
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          Fast onboarding path
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Start today and get a clear score-improvement loop from your first test.
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Register once, run baseline, and unlock guided next actions across speaking, writing, reading, and listening.
        </p>
      </div>
      <div className="mt-6">
        <Image
          src="/marketing/characters/learner-guide.svg"
          alt="Learner onboarding illustration"
          width={520}
          height={520}
          className="w-full h-auto rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5"
          loading="lazy"
        />
      </div>
      <ul className="mt-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <li className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
            check_circle
          </span>
          One free full mock test included
        </li>
        <li className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
            check_circle
          </span>
          AI feedback with actionable next steps
        </li>
        <li className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
            check_circle
          </span>
          Progress stays synced across web and mobile
        </li>
      </ul>
    </aside>
  );
}
