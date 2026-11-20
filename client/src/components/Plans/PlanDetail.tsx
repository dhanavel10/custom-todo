import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Timer, Repeat, Sparkles, AlertTriangle, BookOpenCheck } from 'lucide-react';
import type { Plan, PlanItem } from '../../types';
import { dayLabel, formatTime, isSameDay } from '../../lib/date';
import { nextItem, planStatus } from '../../lib/plans';
import { Button, EmptyState, ProgressRing, Segmented, Skeleton, TaskCheck } from '../ui';
import './Plans.css';

interface Props {
  plan: Plan | null;
  onBack: () => void;
  onToggleItem: (item: PlanItem) => Promise<void>;
  onRescheduleClick: (item: PlanItem) => void;
}

type Filter = 'all' | 'upcoming' | 'completed' | 'missed';

export const PlanDetail = ({ plan, onBack, onToggleItem, onRescheduleClick }: Props) => {
  const [filter, setFilter] = useState<Filter>('all');

  const days = useMemo(() => {
    if (!plan) return [];
    const items = [...plan.items]
      .filter((i) => (filter === 'all' ? true : filter === 'upcoming' ? i.status === 'PENDING' : filter === 'completed' ? i.status === 'COMPLETED' : i.status === 'MISSED'))
      .sort((a, b) => a.dayNumber - b.dayNumber || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    const map = new Map<number, PlanItem[]>();
    for (const it of items) {
      if (!map.has(it.dayNumber)) map.set(it.dayNumber, []);
      map.get(it.dayNumber)!.push(it);
    }
    return Array.from(map.entries());
  }, [plan, filter]);

  const back = (
    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="plan-back">
      All plans
    </Button>
  );

  if (!plan) {
    return (
      <div className="view-enter">
        {back}
        <div className="plan-hero">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton w="45%" h={24} />
            <Skeleton w="70%" h={12} />
          </div>
          <Skeleton w={96} h={96} r={48} />
        </div>
      </div>
    );
  }

  const pct = plan.totalItems ? Math.round((plan.completedItems / plan.totalItems) * 100) : 0;
  const st = planStatus(plan);
  const next = nextItem(plan);
  const rescheduled = plan.items.reduce((n, i) => n + (i.rescheduleCount || 0), 0);
  const pending = plan.items.filter((i) => i.status === 'PENDING').length;
  const now = new Date();
  const seg = (n: number) => `${plan.totalItems ? (n / plan.totalItems) * 100 : 0}%`;

  return (
    <div className="view-enter">
      {back}
      <section className="plan-hero" style={{ ['--plan-c' as string]: st.tone }}>
        <div className="plan-hero-text">
          <span className={`tag tag-sm tag-dot ${st.tag}`}>
            <span>{st.label}</span>
          </span>
          <h2>{plan.title}</h2>
          {plan.description && <p>{plan.description}</p>}
          <div className="plan-stack" aria-label="Progress by status">
            <i className="seg-done" style={{ width: seg(plan.completedItems) }} />
            <i className="seg-missed" style={{ width: seg(plan.missedItems) }} />
          </div>
          <div className="plan-hero-stats">
            <div>
              <b>{plan.completedItems}</b>
              <span>completed</span>
            </div>
            <div>
              <b>{pending}</b>
              <span>remaining</span>
            </div>
            <div className={plan.missedItems ? 'is-alert' : ''}>
              <b>{plan.missedItems}</b>
              <span>missed</span>
            </div>
            <div>
              <b>{rescheduled}</b>
              <span>reschedules</span>
            </div>
          </div>
        </div>
        <ProgressRing value={pct} size={112} stroke={9} color={st.tone} label={`${pct}%`} labelSize={24} />
      </section>

      {next && (
        <div className="callout info plan-next-callout">
          <span className="callout-icon">
            <Sparkles />
          </span>
          <div className="callout-text">
            <strong>Up next: {next.title}</strong> <span>· {dayLabel(new Date(next.scheduledAt))} at {formatTime(new Date(next.scheduledAt))}</span>
          </div>
        </div>
      )}

      <div className="toolbar">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: plan.items.length },
            { value: 'upcoming', label: 'Upcoming', count: pending },
            { value: 'completed', label: 'Done', count: plan.completedItems },
            { value: 'missed', label: 'Missed', count: plan.missedItems }
          ]}
        />
      </div>

      {days.length === 0 ? (
        <EmptyState compact icon={filter === 'missed' ? BookOpenCheck : CalendarClock} tone={filter === 'missed' ? 'var(--green)' : undefined} title={filter === 'missed' ? 'Nothing missed' : 'Nothing here'} description={filter === 'missed' ? "You haven't skipped a single session." : 'No concepts match this filter.'} />
      ) : (
        <ol className="plan-timeline">
          {days.map(([day, items]) => {
            const date = new Date(items[0].scheduledAt);
            const allDone = items.every((i) => i.status === 'COMPLETED');
            const anyMissed = items.some((i) => i.status === 'MISSED');
            const today = isSameDay(date, now);
            return (
              <li key={day} className={`pt-day ${allDone ? 'is-done' : ''} ${anyMissed ? 'is-missed' : ''} ${today ? 'is-today' : ''}`}>
                <div className="pt-rail">
                  <span className="pt-node">{allDone ? '✓' : day}</span>
                </div>
                <div className="pt-content">
                  <div className="pt-day-head">
                    <span className="pt-day-label">Day {day}</span>
                    <span className="t-meta">{dayLabel(date, now)}</span>
                  </div>
                  <div className="pt-items">
                    {items.map((it) => {
                      const isNext = next?.id === it.id;
                      return (
                        <div key={it.id} className={`concept ${it.status.toLowerCase()} ${isNext ? 'is-next' : ''}`}>
                          <TaskCheck checked={it.status === 'COMPLETED'} onToggle={() => void onToggleItem(it)} label={it.status === 'COMPLETED' ? 'Mark as not done' : 'Mark as done'} />
                          <div className="concept-main">
                            <div className="concept-title">
                              <span className="task-title-text">{it.title}</span>
                              {isNext && <span className="tag tag-primary tag-sm">Next up</span>}
                              {it.status === 'MISSED' && (
                                <span className="tag tag-coral tag-sm">
                                  <AlertTriangle />
                                  <span>Missed</span>
                                </span>
                              )}
                            </div>
                            {it.notes && <p className="concept-notes">{it.notes}</p>}
                            <div className="concept-meta">
                              <span>
                                <CalendarClock /> {formatTime(new Date(it.scheduledAt))}
                              </span>
                              <span>
                                <Timer /> {it.durationMinutes} min
                              </span>
                              {it.rescheduleCount > 0 && (
                                <span>
                                  <Repeat /> moved ×{it.rescheduleCount}
                                </span>
                              )}
                            </div>
                          </div>
                          {it.status !== 'COMPLETED' && (
                            <Button size="sm" variant={it.status === 'MISSED' ? 'primary' : 'ghost'} icon={CalendarClock} onClick={() => onRescheduleClick(it)}>
                              <span className="hide-sm">Reschedule</span>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
