import { useEffect, useMemo, useState } from 'react';
import { Download, Moon, Sun, Monitor, User as UserIcon, BellRing, Palette, Database, Sunrise, Sunset, Settings as SettingsIcon, Check, type LucideIcon } from 'lucide-react';
import { api } from '../../lib/api';
import type { User, UserPreferences, PreferencesUpdate } from '../../types';
import { Button, Dialog, Segmented, Switch } from '../ui';
import './Settings.css';

export type ThemePref = 'light' | 'dark' | 'system';

interface SettingsModalProps {
  user: User | null;
  preferences: UserPreferences | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePreferences: (prefs: PreferencesUpdate) => Promise<void>;
  onUpdateUser: (userData: Partial<User>) => Promise<void>;
  themePref: ThemePref;
  onThemePref: (t: ThemePref) => void;
}

type Section = 'profile' | 'reviews' | 'appearance' | 'data';

const SECTIONS: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: 'profile', label: 'Profile', icon: UserIcon },
  { key: 'reviews', label: 'Reviews & reminders', icon: BellRing },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'data', label: 'Data', icon: Database }
];

const LEAD_TIMES = [5, 10, 15, 30, 60, 120];

const zones = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();

export const SettingsModal = ({ user, preferences, isOpen, onClose, onUpdatePreferences, onUpdateUser, themePref, onThemePref }: SettingsModalProps) => {
  const [section, setSection] = useState<Section>('profile');
  const [displayName, setDisplayName] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState('09:00');
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [eveningTime, setEveningTime] = useState('18:00');
  const [leadTime, setLeadTime] = useState(15);
  const [inApp, setInApp] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await api.user.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productivity-inbox-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Load the latest values each time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setDisplayName(user?.displayName || '');
    setTimeZone(user?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setMorningEnabled(Boolean(preferences?.daily_review_morning_enabled ?? 1));
    setMorningTime(preferences?.daily_review_morning_time || '09:00');
    setEveningEnabled(Boolean(preferences?.daily_review_evening_enabled ?? 1));
    setEveningTime(preferences?.daily_review_evening_time || '18:00');
    setLeadTime(preferences?.lead_time_minutes ?? 15);
    setInApp(Boolean(preferences?.in_app_notifications ?? 1));
  }, [isOpen, user, preferences]);

  const leadOptions = useMemo(() => (LEAD_TIMES.includes(leadTime) ? LEAD_TIMES : [...LEAD_TIMES, leadTime].sort((a, b) => a - b)), [leadTime]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await onUpdateUser({ displayName, timeZone });
      await onUpdatePreferences({
        dailyReviewMorningEnabled: morningEnabled,
        dailyReviewMorningTime: morningTime,
        dailyReviewEveningEnabled: eveningEnabled,
        dailyReviewEveningTime: eveningTime,
        leadTimeMinutes: leadTime,
        inAppNotifications: inApp
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const themeCards: { key: ThemePref; label: string; icon: LucideIcon }[] = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor }
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      width={760}
      icon={SettingsIcon}
      title="Settings"
      subtitle={user?.email}
      bare
      footer={
        <>
          {error && <span className="t-caption" style={{ color: 'var(--coral)' }}>{error}</span>}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.key} className={`settings-tab ${section === s.key ? 'is-active' : ''}`} onClick={() => setSection(s.key)} aria-current={section === s.key ? 'true' : undefined}>
                <Icon />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-body" key={section}>
          {section === 'profile' && (
            <>
              <h3 className="settings-h">Profile</h3>
              <p className="settings-p">How you appear in greetings and when dates are shown.</p>
              <div className="field">
                <label className="field-label" htmlFor="set-name">
                  Display name
                </label>
                <input id="set-name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="set-email">
                  Email
                </label>
                <input id="set-email" className="input" value={user?.email ?? ''} disabled />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="set-tz">
                  Time zone
                </label>
                {zones.length ? (
                  <select id="set-tz" className="select" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                    {!zones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id="set-tz" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Asia/Kolkata, America/New_York, UTC…" />
                )}
                <span className="field-hint">Used for daily reviews and reminder delivery.</span>
              </div>
            </>
          )}

          {section === 'reviews' && (
            <>
              <h3 className="settings-h">Daily reviews</h3>
              <p className="settings-p">A short nudge to plan your day and to wrap it up.</p>
              <div className="setting-row">
                <span className="setting-icon">
                  <Sunrise />
                </span>
                <div className="setting-text">
                  <b>Morning briefing</b>
                  <span>What's due today and what slipped</span>
                </div>
                <input type="time" className="input input-sm setting-time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} disabled={!morningEnabled} aria-label="Morning briefing time" />
                <Switch checked={morningEnabled} onChange={setMorningEnabled} />
              </div>
              <div className="setting-row">
                <span className="setting-icon">
                  <Sunset />
                </span>
                <div className="setting-text">
                  <b>Evening wrap-up</b>
                  <span>Review progress and move leftovers</span>
                </div>
                <input type="time" className="input input-sm setting-time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} disabled={!eveningEnabled} aria-label="Evening wrap-up time" />
                <Switch checked={eveningEnabled} onChange={setEveningEnabled} />
              </div>

              <h3 className="settings-h" style={{ marginTop: 26 }}>
                Reminders
              </h3>
              <p className="settings-p">How far ahead of a due time you're alerted by default.</p>
              <div className="field">
                <span className="field-label">Lead time</span>
                <Segmented size="sm" value={String(leadTime)} onChange={(v) => setLeadTime(Number(v))} items={leadOptions.map((m) => ({ value: String(m), label: m >= 60 ? `${m / 60}h` : `${m}m` }))} />
              </div>
              <div className="setting-row" style={{ marginTop: 14 }}>
                <span className="setting-icon">
                  <BellRing />
                </span>
                <div className="setting-text">
                  <b>In-app notifications</b>
                  <span>Show reminders in the notification center</span>
                </div>
                <Switch checked={inApp} onChange={setInApp} />
              </div>
            </>
          )}

          {section === 'appearance' && (
            <>
              <h3 className="settings-h">Theme</h3>
              <p className="settings-p">Applies instantly on this device.</p>
              <div className="theme-cards">
                {themeCards.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.key} className={`theme-card ${themePref === t.key ? 'is-active' : ''}`} onClick={() => onThemePref(t.key)} aria-pressed={themePref === t.key}>
                      <span className={`theme-preview ${t.key}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="theme-card-label">
                        <Icon /> {t.label}
                        {themePref === t.key && <Check className="theme-check" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {section === 'data' && (
            <>
              <h3 className="settings-h">Export & backup</h3>
              <p className="settings-p">Download everything — tasks, notes, captures and reminders — as a JSON file.</p>
              <div className="setting-row">
                <span className="setting-icon">
                  <Database />
                </span>
                <div className="setting-text">
                  <b>Full backup</b>
                  <span>JSON export of your SQLite data</span>
                </div>
                <Button size="sm" variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>
                  Export
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
