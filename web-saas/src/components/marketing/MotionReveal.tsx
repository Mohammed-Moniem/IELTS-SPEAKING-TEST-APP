'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function MotionReveal({ children, className = '', disabled = false }: MotionRevealProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setIsVisible(true);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.1
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className={`${className} ${
        isVisible ? 'motion-reveal-visible' : 'motion-reveal'
      }`}
    >
      {children}
    </div>
  );
}
