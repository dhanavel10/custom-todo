import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Task } from '../types';
import { addDays, formatOverdueBy, startOfDay } from '../lib/date';
import { EmptyState } from '../components/ui';
import { TaskItem } from '../components/TaskItem/TaskItem';
import { byDue, type TaskActions } from './types';

interface Props extends TaskActions {
  tasks: Task[];
  searchQuery: string;
}

interface Bucket {
  key: string;
  label: string;
  heat: string;
  tasks: Task[];
}

export const OverdueView = ({ tasks, searchQuery, ...actions }: Props) => {
  const now = Date.now();
  const overdue = useMemo(
    () => tasks.filter((t) => t.status !== 'ARCHIVED' && t.status !== 'COMPLETED' && t.dueAt && new Date(t.dueAt).getTime() < now).sort(byDue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks]
  );

  const buckets = useMemo<Bucket[]>(() => {
    const today = startOfDay(new Date());
    const yesterday = addDays(today, -1);
    const weekAgo = addDays(today, -7);
    const b: Bucket[] = [
      { key: 'older', label: 'More than a week', heat: 'var(--coral)', tasks: [] },
      { key: 'week', label: 'Earlier this week', heat: 'color-mix(in srgb, var(--coral) 70%, var(--amber))', tasks: [] },
      { key: 'yesterday', label: 'Yesterday', heat: 'color-mix(in srgb, var(--coral) 35%, var(--amber))', tasks: [] },
      { key: 'today', label: 'Earlier today', heat: 'var(--amber)', tasks: [] }
    ];
    for (const t of overdue) {
      const d = new Date(t.dueAt!);
      if (d >= today) b[3].tasks.push(t);
      else if (d >= yesterday) b[2].tasks.push(t);
      else if (d >= weekAgo) b[1].tasks.push(t);
      else b[0].tasks.push(t);
    }
    return b.filter((x) => x.tasks.length);
  }, [overdue]);

  const oldest = overdue[0];
  const critical = overdue.filter((t) => t.eisenhowerQuadrant === 'DO_FIRST' || t.priority === 'URGENT' || t.isDeadline).length;

  if (overdue.length === 0) {
    return (
      <div className="view-enter">
        <EmptyState
          icon={ShieldCheck}
          tone="var(--green)"
          title={searchQuery ? 'No overdue tasks match' : "You're on top of things"}
          description={searchQuery ? `Nothing overdue mentions “${searchQuery}”.` : 'No deadlines have slipped. When one does, it shows up here with a quick way to reschedule.'}
        />
      </div>
    );
  }

  return (
    <div className="view-enter">
      <div className="overdue-summary">
        <div className="overdue-cell main">
          <b>{overdue.length}</b>
          <span>{overdue.length === 1 ? 'task past due' : 'tasks past due'}</span>
        </div>
        <div className="overdue-cell">
          <b>{formatOverdueBy(oldest?.dueAt)}</b>
          <span>oldest is overdue by</span>
        </div>
        <div className="overdue-cell">
          <b>{critical}</b>
          <span>marked critical or deadline</span>
        </div>
      </div>

      {buckets.map((b) => (
        <section key={b.key} className="task-group">
          <div className="overdue-bucket-head">
            <span className="heat" style={{ background: b.heat }} />
            <span className="t-eyebrow">{b.label}</span>
            <span className="count">{b.tasks.length}</span>
          </div>
          <div className="task-list">
            {b.tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                emphasizeOverdue
                prominentReschedule
                onToggleComplete={actions.onToggleComplete}
                onEdit={actions.onEdit}
                onDelete={actions.onDelete}
                onAddReminder={actions.onAddReminder}
                onSnooze={actions.onSnooze}
                onReschedule={actions.onReschedule}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
