'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function MotionHeroScene() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const readDarkMode = () => {
      const classDrivenDark = root.classList.contains('dark');
      const dataThemeDark = root.getAttribute('data-theme') === 'dark';
      setIsDarkTheme(classDrivenDark || dataThemeDark || mediaQuery.matches);
    };

    readDarkMode();
    mediaQuery.addEventListener('change', readDarkMode);

    const observer = new MutationObserver(readDarkMode);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => {
      mediaQuery.removeEventListener('change', readDarkMode);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      data-testid="motion-hero-scene"
      className="relative overflow-hidden rounded-3xl border border-indigo-200/70 dark:border-violet-300/35 bg-white/70 dark:bg-[#12082e] p-6 min-h-[420px] shadow-2xl ring-1 ring-indigo-200/50 dark:ring-violet-300/30"
    >
      <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[radial-gradient(circle_at_20%_24%,rgba(167,139,250,0.48),rgba(18,8,46,0)_48%),radial-gradient(circle_at_82%_78%,rgba(196,181,253,0.32),rgba(18,8,46,0)_44%),linear-gradient(140deg,rgba(51,17,110,0.8),rgba(28,11,66,0.76))]" />
      <div className="absolute inset-0">
        <Image
          src={isDarkTheme ? '/marketing/depth/layer-grid-dark.svg' : '/marketing/depth/layer-grid.svg'}
          alt=""
          fill
          className="object-cover opacity-40 dark:opacity-42"
          priority={false}
        />
      </div>

      <div className="absolute bottom-4 left-4 right-24">
        <div className="relative max-w-[420px] overflow-hidden rounded-2xl border border-indigo-200/60 bg-white/90 dark:border-violet-300/40 dark:bg-gradient-to-br dark:from-[#7c3aed]/35 dark:via-[#5323a8]/85 dark:to-[#32196e]/92 shadow-xl">
          <Image
            src={isDarkTheme ? '/marketing/characters/learner-guide-dark.svg' : '/marketing/characters/learner-guide.svg'}
            alt="Focused IELTS learner reviewing test strategy"
            width={560}
            height={560}
            className="h-auto w-full drop-shadow-2xl"
            priority
          />
          <div className="pointer-events-none absolute inset-0 hidden dark:block bg-gradient-to-tr from-violet-950/20 via-fuchsia-700/20 to-transparent" />
        </div>
      </div>

      <div className="absolute right-4 top-8 w-[180px] space-y-3">
        <div className="rounded-2xl bg-white dark:bg-gradient-to-br dark:from-[#6d28d9] dark:via-[#5b21b6] dark:to-[#3b1a86] border border-indigo-200 dark:border-violet-200/70 px-4 py-3 shadow-lg shadow-violet-950/40 motion-float">
          <p className="text-[11px] uppercase tracking-wider text-indigo-700 dark:text-violet-100 font-semibold">Predicted band</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">7.0</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gradient-to-br dark:from-[#7c3aed] dark:via-[#6d28d9] dark:to-[#4c1d95] border border-cyan-200 dark:border-violet-200/70 px-4 py-3 shadow-lg shadow-violet-950/40 motion-float-delayed">
          <p className="text-[11px] uppercase tracking-wider text-cyan-700 dark:text-violet-100 font-semibold">Weekly streak</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">4 days</p>
        </div>
      </div>
    </div>
  );
}
