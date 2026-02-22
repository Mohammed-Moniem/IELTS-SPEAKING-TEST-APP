'use client';

import { useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';

export default function SettingsPage() {
  const { user } = useAuth();
  const [preferredTrack, setPreferredTrack] = useState<'academic' | 'general'>('academic');
  const [targetBand, setTargetBand] = useState('7.0');

  const roles = useMemo(() => user?.adminRoles?.join(', ') || 'none', [user]);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Account settings</span>
        <h1>Profile and preparation preferences</h1>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h3>Account</h3>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Name:</strong> {user?.firstName} {user?.lastName}</p>
          <p><strong>Plan:</strong> {user?.subscriptionPlan}</p>
          <p><strong>Admin roles:</strong> {roles}</p>
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
          <p className="small">Preference persistence can be connected to profile/preferences endpoints next.</p>
        </div>
      </div>
    </section>
  );
}
