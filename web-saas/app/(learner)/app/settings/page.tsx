'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { requestBrowserPushToken, isBrowserPushSupported, getBrowserPushPermissionState } from '@/lib/push/firebaseWebPush';
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { NotificationSettings } from '@/lib/types';

const PUSH_TOKEN_STORAGE_KEY = 'spokio.web.push.token';

const defaultSettings: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 19,
  dailyReminderMinute: 0,
  achievementsEnabled: true,
  streakRemindersEnabled: true,
  inactivityRemindersEnabled: true,
  feedbackNotificationsEnabled: true,
  directMessagesEnabled: true,
  groupMessagesEnabled: true,
  friendRequestsEnabled: true,
  friendAcceptancesEnabled: true,
  systemAnnouncementsEnabled: true,
  offersEnabled: true,
  partnerOffersEnabled: true
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [preferredTrack, setPreferredTrack] = useState<'academic' | 'general'>('academic');
  const [targetBand, setTargetBand] = useState('7.0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [supportsPush, setSupportsPush] = useState(false);
  const [permissionState, setPermissionState] = useState<'default' | 'denied' | 'granted' | 'unsupported'>('default');
  const [hasRegisteredWebPush, setHasRegisteredWebPush] = useState(false);

  const roles = useMemo(() => user?.adminRoles?.join(', ') || 'none', [user]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [prefs, pushSupported, permission] = await Promise.all([
        apiRequest<NotificationSettings>('/notifications/preferences'),
        isBrowserPushSupported(),
        getBrowserPushPermissionState()
      ]);
      setSettings({ ...defaultSettings, ...prefs });
      setSupportsPush(pushSupported);
      setPermissionState(permission);
      const storedToken = window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      setHasRegisteredWebPush(Boolean(storedToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback(async (nextSettings: NotificationSettings) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const updated = await apiRequest<NotificationSettings>('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(nextSettings)
      });
      setSettings(updated);
      setSuccess('Notification preferences updated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  }, []);

  const onToggle = useCallback(
    async (key: keyof NotificationSettings) => {
      const next = { ...settings, [key]: !settings[key] };
      setSettings(next);
      await persistSettings(next);
    },
    [persistSettings, settings]
  );

  const enableBrowserPush = useCallback(async () => {
    try {
      setError('');
      setSuccess('');
      const token = await requestBrowserPushToken();
      if (!token) {
        setPermissionState('denied');
        setError('Browser push permission denied or not supported.');
        return;
      }

      await apiRequest('/notifications/device/web', {
        method: 'POST',
        body: JSON.stringify({
          token,
          provider: 'fcm',
          locale: navigator.language,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          userAgent: navigator.userAgent
        })
      });

      window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      setHasRegisteredWebPush(true);
      setPermissionState('granted');
      setSuccess('Browser push enabled successfully.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enable browser push');
    }
  }, []);

  const disableBrowserPush = useCallback(async () => {
    try {
      setError('');
      setSuccess('');
      const token = window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (token) {
        await apiRequest('/notifications/device/web', {
          method: 'DELETE',
          body: JSON.stringify({ token })
        });
      }

      window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
      setHasRegisteredWebPush(false);
      setSuccess('Browser push disabled.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disable browser push');
    }
  }, []);

  const browserPushStatusMessage = !supportsPush
    ? 'Browser notifications are not available in this browser yet.'
    : permissionState === 'granted'
      ? 'Browser notifications are on for this device.'
      : permissionState === 'denied'
        ? 'Browser notifications are blocked in this browser.'
        : 'Browser notifications are off for this device.';

  const browserPushRegistrationMessage = !supportsPush
    ? 'Use email and in-app alerts for now while browser notifications are unavailable.'
    : hasRegisteredWebPush
      ? 'This browser is linked to your reminders and study alerts.'
      : 'Turn browser notifications on to receive reminders and study alerts here.';

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Profile & Notification Preferences"
        actions={<StatusBadge tone="brand">Account Settings</StatusBadge>}
      />

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
      {loading ? <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading settings...</div> : null}

      {!loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="Account">
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">Email:</strong> {user?.email}</p>
                <p className="text-gray-700 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">Name:</strong> {user?.firstName} {user?.lastName}</p>
                <p className="text-gray-700 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">Plan:</strong> {user?.subscriptionPlan}</p>
                <p className="text-gray-700 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">Admin roles:</strong> {roles}</p>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Browser Push</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{browserPushStatusMessage}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{browserPushRegistrationMessage}</p>
                <div className="flex gap-2">
                  <button className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50" disabled={!supportsPush || saving} onClick={() => void enableBrowserPush()}>Enable Browser Push</button>
                  <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" disabled={!hasRegisteredWebPush || saving} onClick={() => void disableBrowserPush()}>Disable Browser Push</button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Study Preferences">
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Set your preferred exam track and target band so practice recommendations stay relevant.
              </p>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preferred track</span>
                <select className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={preferredTrack} onChange={e => setPreferredTrack(e.target.value as 'academic' | 'general')}>
                  <option value="academic">Academic</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target band</span>
                <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={targetBand} onChange={e => setTargetBand(e.target.value)} />
              </label>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!loading ? (
        <SectionCard title="Notification Toggles">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Toggle label="System announcements" value={settings.systemAnnouncementsEnabled} disabled={saving} onChange={() => void onToggle('systemAnnouncementsEnabled')} />
            <Toggle label="Special offers" value={settings.offersEnabled} disabled={saving} onChange={() => void onToggle('offersEnabled')} />
            <Toggle label="Partner offers" value={settings.partnerOffersEnabled} disabled={saving} onChange={() => void onToggle('partnerOffersEnabled')} />
            <Toggle label="Inactivity reminders" value={settings.inactivityRemindersEnabled} disabled={saving} onChange={() => void onToggle('inactivityRemindersEnabled')} />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 cursor-pointer">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${value ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
      </button>
    </label>
  );
}
