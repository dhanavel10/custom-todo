import { useState } from 'react';
import { X, Bell, Clock } from 'lucide-react';
import type { Task } from '../../types';

interface ReminderPickerModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSetReminder: (taskId: string, remindAtIso: string) => Promise<void>;
}

export const ReminderPickerModal = ({
  task,
  isOpen,
  onClose,
  onSetReminder
}: ReminderPickerModalProps) => {
  const [customTime, setCustomTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const handlePreset = async (minutesBefore: number) => {
    setIsSubmitting(true);
    try {
      let baseTime = task.dueAt ? new Date(task.dueAt).getTime() : Date.now();
      const remindTime = new Date(baseTime - minutesBefore * 60 * 1000);
      await onSetReminder(task.id, remindTime.toISOString());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTime) return;
    setIsSubmitting(true);
    try {
      await onSetReminder(task.id, new Date(customTime).toISOString());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} /> Set Task Reminder
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Task: <strong>{task.title}</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {task.dueAt && (
            <>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => handlePreset(0)}
                disabled={isSubmitting}
              >
                <Clock size={14} /> At due time
              </button>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => handlePreset(15)}
                disabled={isSubmitting}
              >
                <Clock size={14} /> 15 minutes before due time
              </button>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => handlePreset(60)}
                disabled={isSubmitting}
              >
                <Clock size={14} /> 1 hour before due time
              </button>
            </>
          )}

          <button
            className="btn btn-ghost"
            style={{ justifyContent: 'flex-start' }}
            onClick={() => handlePreset(-60)}
            disabled={isSubmitting}
          >
            <Clock size={14} /> In 1 hour from now
          </button>
        </div>

        <form onSubmit={handleCustom} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label className="label">Or choose a custom reminder date & time</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="datetime-local"
              className="input"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !customTime}>
              Set
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
