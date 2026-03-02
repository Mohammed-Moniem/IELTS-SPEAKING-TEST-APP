'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { webApi } from '@/lib/api/client';
import type { PublicSponsoredContent, SponsorPlacementSlot } from '@/lib/types';

interface SponsorSlotProps {
  /** Which ad slot to fetch content for */
  slot: SponsorPlacementSlot;
  /** Optional CSS class for the outer wrapper */
  className?: string;
  /** Visual variant: 'card' renders a styled card, 'inline' renders a subtle inline block */
  variant?: 'card' | 'inline';
}

/**
 * Reusable component for rendering sponsored ad placements on learner-facing pages.
 *
 * - Gracefully renders nothing when no active ads exist (no layout shift).
 * - Fires impression tracking when the ad scrolls into view.
 * - Fires click tracking on CTA interaction.
 * - Displays "Sponsored" label for transparency.
 */
export function SponsorSlot({ slot, className = '', variant = 'card' }: SponsorSlotProps) {
  const [content, setContent] = useState<PublicSponsoredContent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const impressionFired = useRef(false);
  const slotRef = useRef<HTMLDivElement>(null);

  // Fetch sponsored content for this slot
  useEffect(() => {
    let cancelled = false;
    webApi
      .getActiveSponsoredContent(slot)
      .then(res => {
        if (!cancelled && res.items.length > 0) {
          setContent(res.items[0]);
        }
      })
      .catch(() => {
        // Silently fail — no ad is better than a broken page
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slot]);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!content || impressionFired.current) return;
    const node = slotRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          void webApi.trackSponsoredImpression(content.id);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [content]);

  const handleClick = useCallback(() => {
    if (content) {
      void webApi.trackSponsoredClick(content.id);
    }
  }, [content]);

  // Don't render anything if no sponsored content (graceful empty state — no layout shift)
  if (loaded && !content) return null;

  // Loading skeleton — only shown briefly, also no layout shift if it resolves to empty
  if (!loaded) return null;

  if (variant === 'inline') {
    return (
      <div ref={slotRef} className={`${className}`}>
        <a
          href={content!.ctaUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="group flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm hover:border-violet-300 dark:hover:border-violet-500/40 transition-colors"
        >
          <span className="material-symbols-outlined text-violet-500 text-[16px]">campaign</span>
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
            {content!.headline}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 uppercase tracking-wide font-semibold ml-auto">Sponsored</span>
        </a>
      </div>
    );
  }

  return (
    <div
      ref={slotRef}
      className={`rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/5 p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-violet-500 text-[18px]">campaign</span>
          <span className="text-[10px] text-violet-500 dark:text-violet-400 uppercase tracking-wider font-bold">Sponsored</span>
        </div>
      </div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{content!.headline}</h3>
      {content!.description ? (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{content!.description}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between">
        <a
          href={content!.ctaUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm"
        >
          {content!.ctaLabel || 'Learn more'}
        </a>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">by {content!.advertiserName}</span>
      </div>
    </div>
  );
}
