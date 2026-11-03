import { useState } from 'react';
import { X, Download, Moon, Sun, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import type { User, UserPreferences } from '../../types';

interface SettingsModalProps {
  user: User | null;
  preferences: UserPreferences | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  onUpdateUser: (userData: Partial<User>) => Promise<void>;
  currentTheme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const SettingsModal = ({
  user,
  preferences,
  isOpen,
  onClose,
  onUpdatePreferences,
  onUpdateUser,
  currentTheme,
  onToggleTheme
}: SettingsModalProps) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [timeZone, setTimeZone] = useState(user?.timeZone || 'Asia/Kolkata');
  const [morningEnabled, setMorningEnabled] = useState(Boolean(preferences?.daily_review_morning_enabled ?? 1));
  const [morningTime, setMorningTime] = useState(preferences?.daily_review_morning_time || '09:00');
  const [eveningEnabled, setEveningEnabled] = useState(Boolean(preferences?.daily_review_evening_enabled ?? 1));
  const [eveningTime, setEveningTime] = useState(preferences?.daily_review_evening_time || '18:00');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateUser({ displayName, timeZone });
      await onUpdatePreferences({
        daily_review_morning_enabled: morningEnabled ? 1 : 0,
        daily_review_morning_time: morningTime,
        daily_review_evening_enabled: eveningEnabled ? 1 : 0,
        daily_review_evening_time: eveningTime
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open(api.user.getExportUrl(), '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">Preferences & Settings</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="label">Display Name</label>
            <input
              type="text"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="input-group">
            <label className="label">Time Zone (IANA)</label>
            <input
              type="text"
              className="input"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              placeholder="Asia/Kolkata, America/New_York, UTC..."
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> Daily Productivity Reviews
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={morningEnabled}
                  onChange={(e) => setMorningEnabled(e.target.checked)}
                />
                Morning briefing
              </label>
              <input
                type="time"
                className="input"
                style={{ width: 110, padding: '4px 8px' }}
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                disabled={!morningEnabled}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={eveningEnabled}
                  onChange={(e) => setEveningEnabled(e.target.checked)}
                />
                Evening wrap-up
              </label>
              <input
                type="time"
                className="input"
                style={{ width: 110, padding: '4px 8px' }}
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                disabled={!eveningEnabled}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>Appearance Theme</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onToggleTheme}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {currentTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Export Data & Backup</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Download full SQLite backup JSON</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDownloadBackup}
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
