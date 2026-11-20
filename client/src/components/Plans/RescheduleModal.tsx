import { useState } from 'react';
import { CalendarClock, Check, Moon, Sunrise, CalendarPlus } from 'lucide-react';
import type { PlanItem } from '../../types';
import { addDays, formatDate, toLocalInput } from '../../lib/date';
import { Button, Dialog } from '../ui';
import './Plans.css';

interface Props {
  items: PlanItem[];
  planTitles: Record<string, string>;
  onReschedule: (itemId: string, scheduledAtIso: string) => Promise<void>;
  onClose: () => void;
}

function defaultSlot(): string {
  // Next full hour, at least 30 min out
  const d = new Date(Date.now() + 30 * 60000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

function quickSlots(original: string) {
  const orig = new Date(original);
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrowSame = addDays(now, 1);
  tomorrowSame.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
  const inTwo = addDays(now, 2);
  inTwo.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
  return [
    ...(now.getHours() < 19 ? [{ label: 'Tonight', icon: Moon, date: tonight }] : []),
    { label: 'Tomorrow', icon: Sunrise, date: tomorrowSame },
    { label: 'In 2 days', icon: CalendarPlus, date: inTwo }
  ];
}

/** Asks the user to allot a new time for each plan item they didn't complete. */
export const RescheduleModal = ({ items, planTitles, onReschedule, onClose }: Props) => {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const submit = async (id: string, value?: string) => {
    const v = value ?? times[id] ?? defaultSlot();
    setBusy(id);
    setError('');
    try {
      await onReschedule(id, new Date(v).toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reschedule');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={items.length > 0}
      onClose={onClose}
      width={560}
      icon={CalendarClock}
      iconTone="var(--coral)"
      title={items.length === 1 ? 'A study session was missed' : `${items.length} study sessions were missed`}
      subtitle="Pick a new time for each. They stay flagged as missed until you do."
      footer={
        <>
          {error ? <span className="t-caption" style={{ color: 'var(--coral)' }}>{error}</span> : <span className="t-meta">You can also reschedule later from the plan.</span>}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Decide later
          </Button>
        </>
      }
    >
      <div className="missed-list">
        {items.map((it) => (
          <div key={it.id} className="missed-item">
            <div className="missed-head">
              <div style={{ minWidth: 0 }}>
                <div className="missed-title">{it.title}</div>
                <div className="t-meta">
                  {planTitles[it.planId] ?? 'Study plan'} · Day {it.dayNumber} · was {formatDate(it.scheduledAt)}
                </div>
              </div>
            </div>
            <div className="missed-quick">
              {quickSlots(it.scheduledAt).map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.label} className="chip" disabled={busy === it.id} onClick={() => submit(it.id, toLocalInput(s.date))} title={s.date.toLocaleString()}>
                    <Icon />
                    {s.label}
                    <span className="muted t-num">{s.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </button>
                );
              })}
            </div>
            <div className="missed-custom">
              <input type="datetime-local" className="input input-sm" value={times[it.id] ?? defaultSlot()} onChange={(e) => setTimes((p) => ({ ...p, [it.id]: e.target.value }))} aria-label={`New time for ${it.title}`} />
              <Button size="sm" variant="primary" icon={Check} loading={busy === it.id} onClick={() => submit(it.id)}>
                Set
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
};
