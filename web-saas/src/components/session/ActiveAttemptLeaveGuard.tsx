'use client';

import { useEffect, useRef, useState } from 'react';

import { ModalConfirm } from '@/components/ui/v2';

type PendingNavigation =
  | { type: 'href'; href: string }
  | { type: 'history' };

type ActiveAttemptLeaveGuardProps = {
  enabled: boolean;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirmLeave: () => void | Promise<void>;
};

const GUARD_STATE_KEY = '__spokio_active_attempt_guard__';

export default function ActiveAttemptLeaveGuard({
  enabled,
  title = 'Leave active test?',
  subtitle = 'We will save your current attempt so you can resume later. Continue?',
  confirmLabel = 'Save and Leave',
  cancelLabel = 'Cancel',
  onConfirmLeave
}: ActiveAttemptLeaveGuardProps) {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [saving, setSaving] = useState(false);
  const bypassRef = useRef(false);
  const sentinelInsertedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (!sentinelInsertedRef.current) {
      window.history.pushState({ [GUARD_STATE_KEY]: true }, '', window.location.href);
      sentinelInsertedRef.current = true;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabled || bypassRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const onPopState = () => {
      if (!enabled || bypassRef.current) return;
      setPendingNavigation({ type: 'history' });
      window.history.pushState({ [GUARD_STATE_KEY]: true }, '', window.location.href);
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (!enabled || bypassRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      if (link.hasAttribute('data-no-attempt-guard')) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;

      const currentHref = window.location.href.split('#')[0];
      const nextHref = link.href.split('#')[0];
      if (!nextHref || nextHref === currentHref) return;

      event.preventDefault();
      setPendingNavigation({ type: 'href', href: link.href });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [enabled]);

  const cancelLeave = () => {
    setPendingNavigation(null);
  };

  const confirmLeave = async () => {
    if (!pendingNavigation) return;

    setSaving(true);
    try {
      await onConfirmLeave();
      bypassRef.current = true;

      if (pendingNavigation.type === 'href') {
        window.location.assign(pendingNavigation.href);
        return;
      }

      window.history.back();
    } finally {
      setSaving(false);
      setPendingNavigation(null);
    }
  };

  if (!pendingNavigation) return null;

  return (
    <ModalConfirm
      title={title}
      subtitle={subtitle}
      confirmLabel={saving ? 'Saving...' : confirmLabel}
      cancelLabel={cancelLabel}
      onCancel={cancelLeave}
      onConfirm={() => void confirmLeave()}
      disabled={saving}
    />
  );
}

