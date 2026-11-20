import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, ArrowRight, CalendarClock, CheckCheck, Coffee, Flame, Plus, ChevronDown } from 'lucide-react';
import type { Capture, Task, User } from '../types';
import { formatTime, greeting, isSameDay, toLocalInput } from '../lib/date';
import { quadrantOf } from '../lib/quadrants';
import { Button, EmptyState, ProgressRing } from '../components/ui';
import { TaskItem } from '../components/TaskItem/TaskItem';
import { QuickCapture } from '../components/QuickCapture/QuickCapture';
import { byDue, byImportance, type TaskActions } from './types';

interface Props extends TaskActions {
  tasks: Task[];
  user: User | null;
  overdueCount: number;
  onGoOverdue: () => void;
  onQuickCreate: (title: string, iso: string) => Promise<void>;
  onCaptureSaved: (c: Capture) => void;
  onTaskCreated: (t: Task) => void;
  onCaptureConverted: (id: string) => void;
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function defaultTime(now: Date) {
  const d = new Date(now.getTime() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  if (!isSameDay(d, now)) d.setTime(new Date(now).setHours(23, 30, 0, 0));
  return toLocalInput(d).slice(11);
}

export const TodayView = (props: Props) => {
  const { tasks, user, overdueCount, onGoOverdue, onQuickCreate } = props;
  const now = useNow();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(() => defaultTime(new Date()));
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const today = useMemo(() => tasks.filter((t) => t.status !== 'ARCHIVED' && t.dueAt && isSameDay(new Date(t.dueAt), now)), [tasks, now]);
  const done = today.filter((t) => t.status === 'COMPLETED');
  const open = today.filter((t) => t.status !== 'COMPLETED').sort(byImportance);
  const schedule = [...today].sort(byDue);
  const pct = today.length ? Math.round((done.length / today.length) * 100) : 0;
  const firstName = (user?.displayName || '').split(' ')[0];

  const message =
    today.length === 0
      ? 'Nothing is scheduled for today yet. Capture something below, or pull work forward from your matrix.'
      : open.length === 0
        ? 'Everything planned for today is done. Take the win.'
        : `${open.length} ${open.length === 1 ? 'task' : 'tasks'} to go${open[0] ? ` — start with “${open[0].title}”.` : '.'}`;

  // Where the "now" marker falls in the agenda
  const nowIdx = schedule.findIndex((t) => new Date(t.dueAt!).getTime() > now.getTime());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    const [h, m] = time.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h || 18, m || 0, 0, 0);
    setSaving(true);
    try {
      await onQuickCreate(title.trim(), d.toISOString());
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  const row = (t: Task) => (
    <TaskItem
      key={t.id}
      task={t}
      onToggleComplete={props.onToggleComplete}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
      onAddReminder={props.onAddReminder}
      onReschedule={props.onReschedule}
    />
  );

  return (
    <div className="view-enter">
      <section className="today-hero">
        <div>
          <div className="today-date">
            <span className="t-eyebrow">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <h2>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p>{message}</p>
        </div>
        <div className="today-ring-wrap">
          <div className="today-stats">
            <div className="today-stat">
              <b>{open.length}</b>
              <span>Remaining</span>
            </div>
            <div className="today-stat">
              <b>{done.length}</b>
              <span>Completed</span>
            </div>
            {overdueCount > 0 && (
              <div className="today-stat danger">
                <b>{overdueCount}</b>
                <span>Overdue</span>
              </div>
            )}
          </div>
          <ProgressRing value={pct} size={76} stroke={7} color={pct === 100 ? 'var(--green)' : undefined} label={`${pct}%`} labelSize={17} />
        </div>
      </section>

      <QuickCapture onCaptureSaved={props.onCaptureSaved} onTaskCreated={props.onTaskCreated} onCaptureConverted={props.onCaptureConverted} />

      {overdueCount > 0 && (
        <div className="callout">
          <span className="callout-icon">
            <AlarmClock />
          </span>
          <div className="callout-text">
            <strong>
              {overdueCount} {overdueCount === 1 ? 'task' : 'tasks'} slipped past a deadline.
            </strong>{' '}
            <span>Reschedule or finish them so they stop hanging over today.</span>
          </div>
          <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={onGoOverdue}>
            Review
          </Button>
        </div>
      )}

      <div className="today-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Flame /> Focus list
            </h3>
            <span className="count">{open.length}</span>
            <span className="spacer" />
            <span className="t-meta">by priority</span>
          </div>
          {open.length === 0 ? (
            <EmptyState
              compact
              icon={today.length ? CheckCheck : Coffee}
              tone={today.length ? 'var(--green)' : undefined}
              title={today.length ? 'All clear for today' : 'A blank slate'}
              description={today.length ? 'Every task due today is complete.' : 'Add a task for today using the schedule panel.'}
            />
          ) : (
            <div className="task-list">{open.map(row)}</div>
          )}

          {done.length > 0 && (
            <>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                <ChevronDown style={{ transform: showDone ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
                {showDone ? 'Hide' : 'Show'} {done.length} completed
              </button>
              {showDone && <div className="task-list anim-rise">{done.map(row)}</div>}
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <CalendarClock /> Schedule
            </h3>
            <span className="spacer" />
            <span className="t-meta t-mono">{formatTime(now)}</span>
          </div>

          {schedule.length === 0 ? (
            <EmptyState compact icon={CalendarClock} title="No timed tasks" description="Anything due today shows up here in time order." />
          ) : (
            <div className="agenda">
              {schedule.map((t, i) => {
                const due = new Date(t.dueAt!);
                const q = quadrantOf(t.eisenhowerQuadrant);
                return (
                  <div key={t.id}>
                    {i === nowIdx && (
                      <div className="agenda-now" aria-label="Current time">
                        <span>NOW</span>
                        <i />
                        <hr />
                      </div>
                    )}
                    <div
                      className={`agenda-item ${t.status === 'COMPLETED' ? 'is-done' : ''} ${due < now ? 'is-past' : ''}`}
                      style={{ ['--q-c' as string]: q?.color ?? 'var(--text-3)', animationDelay: `${i * 30}ms` }}
                      onClick={() => props.onEdit(t)}
                    >
                      <span className="agenda-time">{formatTime(due)}</span>
                      <span className="agenda-node">
                        <i />
                      </span>
                      <span className="agenda-title">{t.title}</span>
                    </div>
                  </div>
                );
              })}
              {nowIdx === -1 && (
                <div className="agenda-now" aria-label="Current time">
                  <span>NOW</span>
                  <i />
                  <hr />
                </div>
              )}
            </div>
          )}

          <form onSubmit={submit} className="inline-add" style={{ marginTop: 12 }}>
            <Plus className="inline-add-icon" />
            <input className="inline-add-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to today…" aria-label="New task for today" disabled={saving} />
            <input type="time" className="input input-sm inline-add-time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
            <Button type="submit" size="sm" variant="primary" disabled={!title.trim()} loading={saving}>
              Add
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
};
