import { useEffect, useState } from 'react';
import { Bell, AlarmClock, Clock, Timer, Hourglass, Sunrise, CalendarClock, type LucideIcon } from 'lucide-react';
import type { Task } from '../../types';
import { addDays, formatDate, toLocalInput } from '../../lib/date';
import { Button, Dialog } from '../ui';

interface ReminderPickerModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSetReminder: (taskId: string, remindAtIso: string) => Promise<void>;
}

interface Preset {
  key: string;
  label: string;
  icon: LucideIcon;
  at: Date;
}

export const ReminderPickerModal = ({ task, isOpen, onClose, onSetReminder }: ReminderPickerModalProps) => {
  const [customTime, setCustomTime] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const d = new Date(Date.now() + 60 * 60_000);
      d.setMinutes(0, 0, 0);
      setCustomTime(toLocalInput(d));
    }
  }, [isOpen]);

  const set = async (key: string, at: Date) => {
    if (!task) return;
    setBusy(key);
    try {
      await onSetReminder(task.id, at.toISOString());
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const now = Date.now();
  const presets: Preset[] = [];
  if (task?.dueAt) {
    const due = new Date(task.dueAt).getTime();
    presets.push(
      { key: 'due', label: 'At due time', icon: AlarmClock, at: new Date(due) },
      { key: '15', label: '15 min before', icon: Timer, at: new Date(due - 15 * 60_000) },
      { key: '60', label: '1 hour before', icon: Hourglass, at: new Date(due - 60 * 60_000) }
    );
  }
  presets.push({ key: 'h1', label: 'In 1 hour', icon: Clock, at: new Date(now + 60 * 60_000) });
  const tm = addDays(new Date(), 1);
  tm.setHours(9, 0, 0, 0);
  presets.push({ key: 'tm', label: 'Tomorrow morning', icon: Sunrise, at: tm });
  const visible = presets.filter((p) => p.key === 'h1' || p.key === 'tm' || p.at.getTime() > now);

  return (
    <Dialog open={isOpen && !!task} onClose={onClose} width={460} icon={Bell} title="Set a reminder" subtitle="You'll get an in-app notification at the chosen time.">
      {task && (
        <>
          <div className="task-context">
            <CalendarClock size={15} className="muted" />
            <strong>{task.title}</strong>
            {task.dueAt && <span className="t-meta">due {formatDate(task.dueAt)}</span>}
          </div>
          <div className="preset-grid">
            {visible.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.key} className="preset" disabled={!!busy} onClick={() => set(p.key, p.at)}>
                  <span className="preset-title">
                    <Icon /> {p.label}
                  </span>
                  <span className="preset-sub">{busy === p.key ? 'Scheduling…' : formatDate(p.at.toISOString())}</span>
                </button>
              );
            })}
          </div>
          <div className="divider-label">or pick a time</div>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (customTime) void set('custom', new Date(customTime));
            }}
          >
            <input type="datetime-local" className="input" value={customTime} onChange={(e) => setCustomTime(e.target.value)} required aria-label="Custom reminder time" />
            <Button type="submit" variant="primary" loading={busy === 'custom'} disabled={!customTime}>
              Set
            </Button>
          </form>
        </>
      )}
    </Dialog>
  );
};
