import { useEffect, useState } from 'react';
import { GraduationCap, Calendar, Clock, Layers, Timer, Sparkles } from 'lucide-react';
import type { NewPlanItem } from '../../types';
import { formatDueShort, toLocalInput } from '../../lib/date';
import { parseConcepts } from '../../lib/plans';
import { Button, Dialog } from '../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (body: { title: string; description?: string; items: NewPlanItem[] }) => Promise<void>;
}

const PREVIEW_MAX = 8;

export const NewPlanDialog = ({ open, onClose, onCreate }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [concepts, setConcepts] = useState('');
  const [startDate, setStartDate] = useState(() => toLocalInput(new Date()).slice(0, 10));
  const [time, setTime] = useState('19:00');
  const [perDay, setPerDay] = useState(1);
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  const preview = concepts.trim() && startDate && time ? parseConcepts(concepts, startDate, time, perDay, duration) : [];
  const days = preview.length ? preview[preview.length - 1].dayNumber : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give your plan a name.');
      return;
    }
    if (preview.length === 0) {
      setError('Add at least one concept (one per line).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined, items: preview });
      setTitle('');
      setDescription('');
      setConcepts('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={760}
      icon={GraduationCap}
      title="New study plan"
      subtitle="Concepts are spread across days in the order you list them."
      footer={
        <>
          {error ? <span className="t-caption" style={{ color: 'var(--coral)' }}>{error}</span> : <span className="t-meta">{preview.length ? `${preview.length} concepts over ${days} ${days === 1 ? 'day' : 'days'}` : 'Paste or type concepts to see the schedule'}</span>}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-plan-form" loading={saving}>
            Create plan
          </Button>
        </>
      }
    >
      <form id="new-plan-form" onSubmit={submit} className="new-plan">
        <div className="new-plan-form">
          <div className="field">
            <label className="field-label" htmlFor="plan-title">
              Plan name
            </label>
            <input id="plan-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. System Design in 14 days" autoFocus />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="plan-desc">
              Goal <span className="muted">(optional)</span>
            </label>
            <input id="plan-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you be able to do at the end?" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="plan-concepts">
              Concepts <span className="muted">— one per line, in order</span>
            </label>
            <textarea id="plan-concepts" className="textarea" rows={8} value={concepts} onChange={(e) => setConcepts(e.target.value)} placeholder={'Load balancing\nCaching strategies\nDatabase sharding\nMessage queues'} />
            <span className="field-hint">Prefixes like “Day 3:”, “1.” or “-” are removed automatically.</span>
          </div>
          <div className="field-row four">
            <div className="field">
              <label className="field-label" htmlFor="plan-start">
                <Calendar /> Start
              </label>
              <input id="plan-start" type="date" className="input" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="plan-time">
                <Clock /> Daily time
              </label>
              <input id="plan-time" type="time" className="input" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="plan-per">
                <Layers /> Per day
              </label>
              <input id="plan-per" type="number" min={1} max={10} className="input" value={perDay} onChange={(e) => setPerDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="plan-dur">
                <Timer /> Minutes
              </label>
              <input id="plan-dur" type="number" min={5} step={5} className="input" value={duration} onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 60))} />
            </div>
          </div>
        </div>

        <aside className="new-plan-preview" aria-label="Schedule preview">
          <div className="t-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} /> Preview
          </div>
          {preview.length === 0 ? (
            <div className="preview-empty">Your day-by-day schedule will appear here as you type.</div>
          ) : (
            <ol className="preview-list">
              {preview.slice(0, PREVIEW_MAX).map((it, i) => (
                <li key={i} style={{ animationDelay: `${i * 25}ms` }}>
                  <span className="preview-day">D{it.dayNumber}</span>
                  <span className="preview-title">{it.title}</span>
                  <span className="preview-when">{formatDueShort(it.scheduledAt)}</span>
                </li>
              ))}
              {preview.length > PREVIEW_MAX && <li className="preview-more">+ {preview.length - PREVIEW_MAX} more</li>}
            </ol>
          )}
        </aside>
      </form>
    </Dialog>
  );
};
