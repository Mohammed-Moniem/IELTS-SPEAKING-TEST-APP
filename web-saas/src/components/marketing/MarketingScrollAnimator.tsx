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

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add('scroll-reveal-in');
          observer.unobserve(element);
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.08
      }
    );

    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connectTargets = () => {
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR)
      ).filter(element => {
        if (element.closest('.motion-reveal, .motion-reveal-visible')) return false;
        if (element.dataset.skipScrollReveal === 'true') return false;
        if (element.classList.contains('scroll-reveal-init')) return false;
        if (element.classList.contains('scroll-reveal-in')) return false;
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
        const isAboveFold = element.getBoundingClientRect().top < window.innerHeight * 0.85;
        if (isAboveFold) {
          element.classList.add('scroll-reveal-in');
          return;
        }

        element.classList.add('scroll-reveal-init');
        element.style.setProperty('--scroll-reveal-delay', `${(index % 6) * 55}ms`);
        observer.observe(element);
      });
    };

    connectTargets();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
