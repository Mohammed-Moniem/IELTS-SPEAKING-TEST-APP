'use client';

import type { ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

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
    <header className="v2-page-header">
      <div className="v2-page-header-main">
        {kicker ? <p className="v2-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="v2-page-header-actions">{actions}</div> : null}
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
    <article className={cx('v2-metric-card', `tone-${tone}`)}>
      <p className="v2-metric-label">{label}</p>
      <p className="v2-metric-value">{value}</p>
      <div className="v2-metric-footer">
        {delta ? <span className="v2-metric-delta">{delta}</span> : null}
        {helper ? <span className="small">{helper}</span> : null}
      </div>
    </article>
  );
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('v2-status-badge', `tone-${tone}`)}>{children}</span>;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('v2-section-card', className)}>
      {title || subtitle || actions ? (
        <div className="v2-section-head">
          <div className="stack">
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p className="small">{subtitle}</p> : null}
          </div>
          {actions ? <div className="cta-row">{actions}</div> : null}
        </div>
      ) : null}
      {children}
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
    <div className="v2-segmented-tabs" role="tablist" aria-label="Segments">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={cx('v2-segment', option.value === value && 'active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SkeletonSet({ rows = 4 }: { rows?: number }) {
  return (
    <div className="v2-skeleton-set">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="v2-skeleton-row" key={index} />
      ))}
    </div>
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
    <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
      <div className="v2-modal">
        <div className="v2-modal-head">
          <h3>{title}</h3>
          {subtitle ? <p className="small">{subtitle}</p> : null}
        </div>
        {children ? <div className="v2-modal-body">{children}</div> : null}
        <div className="v2-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel || 'Cancel'}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={disabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
