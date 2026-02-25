'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { requestBrowserPushToken, isBrowserPushSupported, getBrowserPushPermissionState } from '@/lib/push/firebaseWebPush';
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

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Account settings</span>
        <h1>Profile and notification preferences</h1>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
      {loading ? <div className="panel">Loading settings...</div> : null}

      {!loading ? (
        <div className="grid-2">
          <div className="panel stack">
            <h3>Account</h3>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Name:</strong> {user?.firstName} {user?.lastName}</p>
            <p><strong>Plan:</strong> {user?.subscriptionPlan}</p>
            <p><strong>Admin roles:</strong> {roles}</p>

            <h3 style={{ marginTop: 16 }}>Browser push</h3>
            <p className="small">Status: {supportsPush ? permissionState : 'unsupported'}</p>
            <p className="small">Registration: {hasRegisteredWebPush ? 'active' : 'not registered'}</p>
            <div className="cta-row">
              <button className="btn btn-primary" disabled={!supportsPush || saving} onClick={() => void enableBrowserPush()}>
                Enable Browser Push
              </button>
              <button className="btn btn-secondary" disabled={!hasRegisteredWebPush || saving} onClick={() => void disableBrowserPush()}>
                Disable Browser Push
              </button>
            </div>
          </div>

          <div className="panel stack">
            <h3>Study defaults (UI only)</h3>
            <label className="stack">
              <span>Preferred track</span>
              <select className="select" value={preferredTrack} onChange={e => setPreferredTrack(e.target.value as 'academic' | 'general')}>
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="stack">
              <span>Target band</span>
              <input className="input" value={targetBand} onChange={e => setTargetBand(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="panel stack" style={{ marginTop: 16 }}>
          <h3>Notification toggles</h3>
          <div className="grid-2">
            <Toggle label="Direct messages" value={settings.directMessagesEnabled} disabled={saving} onChange={() => void onToggle('directMessagesEnabled')} />
            <Toggle label="Group messages" value={settings.groupMessagesEnabled} disabled={saving} onChange={() => void onToggle('groupMessagesEnabled')} />
            <Toggle label="Friend requests" value={settings.friendRequestsEnabled} disabled={saving} onChange={() => void onToggle('friendRequestsEnabled')} />
            <Toggle label="Friend acceptances" value={settings.friendAcceptancesEnabled} disabled={saving} onChange={() => void onToggle('friendAcceptancesEnabled')} />
            <Toggle label="System announcements" value={settings.systemAnnouncementsEnabled} disabled={saving} onChange={() => void onToggle('systemAnnouncementsEnabled')} />
            <Toggle label="Special offers" value={settings.offersEnabled} disabled={saving} onChange={() => void onToggle('offersEnabled')} />
            <Toggle label="Partner offers" value={settings.partnerOffersEnabled} disabled={saving} onChange={() => void onToggle('partnerOffersEnabled')} />
            <Toggle label="Inactivity reminders" value={settings.inactivityRemindersEnabled} disabled={saving} onChange={() => void onToggle('inactivityRemindersEnabled')} />
          </div>
        </div>
      ) : null}
    </section>
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
    <label className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{label}</span>
      <input type="checkbox" checked={value} disabled={disabled} onChange={onChange} />
    </label>
  );
}
