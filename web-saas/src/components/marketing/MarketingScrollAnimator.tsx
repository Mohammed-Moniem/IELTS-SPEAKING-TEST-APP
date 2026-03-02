'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const SCROLL_REVEAL_SELECTOR = 'main section, main article, main form';

export function MarketingScrollAnimator() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;
    if (!('IntersectionObserver' in window)) return;

    const revealDelays = new WeakMap<HTMLElement, number>();
    const scheduled = new WeakSet<HTMLElement>();

    const revealElement = (element: HTMLElement) => {
      if (!('animate' in element)) return;
      const delay = revealDelays.get(element) ?? 0;
      element.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 16px, 0)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)' }
        ],
        {
          duration: 580,
          delay,
          easing: 'cubic-bezier(0.2, 1, 0.32, 1)',
          fill: 'both'
        }
      );
    };

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          revealElement(element);
          observer.unobserve(element);
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.08
      }
    );

    let didCancel = false;
    let bootTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connectTargets = () => {
      if (didCancel) return;

      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR)
      ).filter(element => {
        if (element.closest('.motion-reveal, .motion-reveal-visible')) return false;
        if (element.dataset.skipScrollReveal === 'true') return false;
        if (scheduled.has(element)) return false;
        return true;
      });

      if (!targets.length) {
        if (retries < 8) {
          retries += 1;
          retryTimer = setTimeout(connectTargets, 120);
        }
        return;
      }

      targets.forEach((element, index) => {
        scheduled.add(element);
        revealDelays.set(element, (index % 6) * 55);
        const isAboveFold = element.getBoundingClientRect().top < window.innerHeight * 0.85;
        if (isAboveFold) {
          return;
        }

        observer.observe(element);
      });
    };

    const runAfterHydration = () => {
      // Delay initial DOM class mutations until after full load to avoid hydration mismatches.
      bootTimer = setTimeout(connectTargets, 120);
    };

    if (document.readyState === 'complete') {
      runAfterHydration();
    } else {
      window.addEventListener('load', runAfterHydration, { once: true });
    }

    return () => {
      didCancel = true;
      window.removeEventListener('load', runAfterHydration);
      if (bootTimer) clearTimeout(bootTimer);
      if (retryTimer) clearTimeout(retryTimer);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
