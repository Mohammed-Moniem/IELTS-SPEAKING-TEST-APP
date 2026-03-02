'use client';

type MarketingGraphicLayerPreset = 'hero' | 'content-highlight';
type MarketingGraphicLayerIntensity = 'subtle' | 'balanced' | 'bold';

type MarketingGraphicLayerProps = {
  preset: MarketingGraphicLayerPreset;
  intensity?: MarketingGraphicLayerIntensity;
  className?: string;
};

const opacityByIntensity: Record<MarketingGraphicLayerIntensity, string> = {
  subtle: 'opacity-65',
  balanced: 'opacity-85',
  bold: 'opacity-100'
};

export function MarketingGraphicLayer({
  preset,
  intensity = 'balanced',
  className = ''
}: MarketingGraphicLayerProps) {
  const opacityClass = opacityByIntensity[intensity];

  if (preset === 'hero') {
    return (
      <div
        aria-hidden
        data-testid="marketing-graphic-layer-hero"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${opacityClass} ${className}`}
      >
        <div className="absolute inset-0 bg-[url('/marketing/depth/purple-dot-grid.svg')] bg-[length:44px_44px] opacity-30" />
        <div className="motion-float-slow absolute -left-20 top-10 h-56 w-56 rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-400/25" />
        <div className="motion-float-delayed absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-fuchsia-300/30 blur-3xl dark:bg-fuchsia-300/20" />
        <div className="motion-gradient-drift absolute inset-y-0 right-10 w-56 rotate-12 bg-gradient-to-b from-white/20 via-violet-200/15 to-transparent blur-2xl" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      data-testid="marketing-graphic-layer-content"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${opacityClass} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(167,139,250,0.16),transparent_46%),radial-gradient(circle_at_85%_78%,rgba(216,180,254,0.14),transparent_44%)]" />
      <div className="motion-float-soft absolute -top-14 left-8 h-28 w-28 rounded-full border border-violet-300/40 bg-violet-300/15 blur-xl dark:border-violet-400/30 dark:bg-violet-400/10" />
      <div className="motion-float-delayed absolute bottom-4 right-10 h-20 w-20 rounded-2xl border border-violet-300/35 bg-fuchsia-200/10 backdrop-blur-sm dark:border-fuchsia-400/20 dark:bg-fuchsia-300/10" />
      <div className="absolute inset-0 bg-[url('/marketing/depth/purple-dot-grid.svg')] bg-[length:40px_40px] opacity-[0.14]" />
    </div>
  );
}
