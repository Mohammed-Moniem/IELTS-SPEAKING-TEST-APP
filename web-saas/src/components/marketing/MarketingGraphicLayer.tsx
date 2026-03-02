/**
 * Decorative background graphic layer for marketing pages.
 * Renders subtle animated SVG patterns behind content sections.
 */

interface MarketingGraphicLayerProps {
  preset?: 'content-highlight' | 'hero-accent' | 'card-glow';
  intensity?: 'subtle' | 'medium' | 'bold';
  className?: string;
}

export function MarketingGraphicLayer({
  preset = 'content-highlight',
  intensity = 'subtle',
  className = '',
}: MarketingGraphicLayerProps) {
  const opacityMap = {
    subtle: 'opacity-[0.06]',
    medium: 'opacity-[0.12]',
    bold: 'opacity-[0.20]',
  };

  const opacity = opacityMap[intensity];

  if (preset === 'hero-accent') {
    return (
      <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
        <div className={`absolute -top-1/4 -right-1/4 h-[140%] w-[140%] rounded-full bg-gradient-to-br from-violet-400 to-violet-600 blur-3xl ${opacity}`} />
      </div>
    );
  }

  if (preset === 'card-glow') {
    return (
      <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3/4 w-3/4 rounded-full bg-violet-500 blur-3xl ${opacity}`} />
      </div>
    );
  }

  // Default: content-highlight — a subtle top-right glow
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
      <div className={`absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-400 blur-3xl ${opacity}`} />
      <div className={`absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-violet-300 blur-2xl ${opacity}`} />
    </div>
  );
}
