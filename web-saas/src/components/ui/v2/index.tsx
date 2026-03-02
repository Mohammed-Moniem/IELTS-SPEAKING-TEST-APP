'use client';

import type { ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// Map tones to Tailwind color classes
const toneStyles: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  brand: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
};

const toneTextStyles: Record<Tone, string> = {
  neutral: 'text-gray-900 dark:text-gray-100',
  brand: 'text-violet-700 dark:text-violet-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-red-700 dark:text-red-400',
  info: 'text-blue-700 dark:text-blue-400'
};

const toneRingStyles: Record<Tone, string> = {
  neutral: 'ring-gray-200 dark:ring-gray-800',
  brand: 'ring-violet-200 dark:ring-violet-500/30',
  success: 'ring-emerald-200 dark:ring-emerald-500/30',
  warning: 'ring-amber-200 dark:ring-amber-500/30',
  danger: 'ring-red-200 dark:ring-red-500/30',
  info: 'ring-blue-200 dark:ring-blue-500/30'
};

export function PageHeader({
  title,
  subtitle,
  actions,
  kicker
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  kicker?: string;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6 border-b border-gray-100 dark:border-gray-800/60 transition-all duration-300">
      <div className="flex-1 space-y-1.5">
        {kicker ? <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">{kicker}</p> : null}
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl drop-shadow-sm">{title}</h1>
        {subtitle ? <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  delta,
  tone = 'neutral'
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  delta?: ReactNode;
  tone?: Tone;
}) {
  return (
    <article className={cx(
      'group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] dark:bg-gray-900',
      toneStyles[tone]
    )}>
      {/* Decorative gradient orb */}
      <div className={cx(
        'absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-3xl transition-transform duration-500 group-hover:scale-150',
        tone === 'brand' ? 'bg-violet-500' :
          tone === 'success' ? 'bg-emerald-500' :
            tone === 'warning' ? 'bg-amber-500' :
              tone === 'danger' ? 'bg-red-500' :
                tone === 'info' ? 'bg-blue-500' :
                  'bg-gray-500'
      )} />

      <p className="relative z-10 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="relative z-10 flex items-baseline gap-3">
        <p className={cx('text-4xl font-black tracking-tight', toneTextStyles[tone])}>{value}</p>
        {delta ? <span className="text-sm font-bold opacity-90">{delta}</span> : null}
      </div>
      {helper ? <div className="relative z-10 mt-3 pt-3 border-t border-current/10 text-xs font-medium opacity-80">{helper}</div> : null}
    </article>
  );
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset shadow-sm transition-all',
      toneStyles[tone],
      toneRingStyles[tone]
    )}>
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx(
      'rounded-2xl border border-gray-200/80 bg-white/50 backdrop-blur-sm shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)] dark:border-gray-800/80 dark:bg-gray-900/50 transition-all duration-300',
      className
    )}>
      {title || subtitle || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60 px-6 py-5">
          <div className="space-y-1">
            {title ? <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-gray-100/80 p-1 shadow-inner dark:bg-gray-800/80 backdrop-blur-sm" role="tablist" aria-label="Segments">
      {options.map(option => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cx(
              'relative flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold outline-none transition-all duration-300',
              isActive
                ? 'bg-white text-gray-900 shadow-sm shadow-black/5 ring-1 ring-gray-900/5 dark:bg-gray-700 dark:text-white dark:ring-white/10'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-white/55 dark:hover:bg-gray-700/50'
            )}
            onClick={() => onChange(option.value)}
            role="tab"
            aria-selected={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SkeletonSet({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="h-4 rounded-full bg-slate-200 dark:bg-slate-700/50"
          key={index}
          style={{ width: index === rows - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-8 py-16 text-center transition-colors hover:border-violet-300 hover:bg-violet-50/30 dark:border-gray-800 dark:bg-gray-900/30 dark:hover:border-violet-700/50 dark:hover:bg-violet-900/10">
      <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
        <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500">category</span>
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      {body ? <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p> : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
  retryLabel = 'Retry'
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/80 px-5 py-5 shadow-sm dark:border-red-900/30 dark:bg-red-900/10 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
      <div className="flex gap-4">
        <div className="shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">{title}</h3>
          {body ? <p className="mt-1.5 text-sm text-red-700/90 dark:text-red-400/90 leading-relaxed">{body}</p> : null}
          {onRetry ? (
            <button
              type="button"
              className="mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition-all hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BlockedState({
  title,
  body,
  action
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
      <div className="flex gap-4">
        <div className="shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">lock</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">{title}</h3>
          {body ? <p className="mt-1.5 text-sm text-amber-700/90 dark:text-amber-400/90 leading-relaxed">{body}</p> : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function SessionStatusStrip({
  timerLabel,
  completionLabel,
  unsolvedLabel,
  actions
}: {
  timerLabel: string;
  completionLabel: string;
  unsolvedLabel: string;
  actions?: ReactNode;
}) {
  return (
    <article className="sticky top-0 z-30 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white/80 px-5 py-3.5 shadow-sm backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/80">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700 shadow-inner dark:bg-violet-500/10 dark:text-violet-300 ring-1 ring-inset ring-violet-500/20">
          <span className="material-symbols-outlined text-[18px]">timer</span>
          {timerLabel}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {completionLabel}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
          <span className="material-symbols-outlined text-[18px]">help</span>
          {unsolvedLabel}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </article>
  );
}

export function ModalConfirm({
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  disabled,
  children
}: {
  title: string;
  subtitle?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm transition-all duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 pb-4 pt-6 text-center sm:text-left">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
          {subtitle ? <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>

        {children ? (
          <div className="border-y border-gray-100 bg-gray-50/50 px-6 py-5 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-300">
            {children}
          </div>
        ) : null}

        <div className="flex flex-col-reverse justify-end gap-3 px-6 py-5 sm:flex-row">
          <button
            type="button"
            className="inline-flex w-full justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white sm:w-auto ring-1 ring-inset ring-gray-300 dark:ring-gray-700"
            onClick={onCancel}
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className="inline-flex w-full justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
