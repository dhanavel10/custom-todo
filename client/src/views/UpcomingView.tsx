import { useMemo } from 'react';
import { CalendarClock, Telescope } from 'lucide-react';
import type { Task } from '../types';
import { addDays, dayDiff, dayLabel, startOfDay, toDateKey } from '../lib/date';
import { EmptyState } from '../components/ui';
import { TaskItem } from '../components/TaskItem/TaskItem';
import { byDue, type TaskActions } from './types';

interface Props extends TaskActions {
  tasks: Task[];
  searchQuery: string;
}

const STRIP_DAYS = 21;

export const UpcomingView = ({ tasks, searchQuery, ...actions }: Props) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  const groups = useMemo(() => {
    const future = tasks
      .filter((t) => t.status !== 'ARCHIVED' && t.status !== 'COMPLETED' && t.dueAt && new Date(t.dueAt) >= tomorrowStart)
      .sort(byDue);
    const map = new Map<string, Task[]>();
    for (const t of future) {
      const key = toDateKey(new Date(t.dueAt!));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tomorrowStart.getTime()]);

  const countByKey = useMemo(() => new Map(groups.map(([k, list]) => [k, list.length])), [groups]);
  const total = groups.reduce((n, [, l]) => n + l.length, 0);

  const jump = (key: string) => document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="view-enter">
      <div className="date-strip" role="list" aria-label="Next three weeks">
        {Array.from({ length: STRIP_DAYS }).map((_, i) => {
          const d = addDays(tomorrowStart, i);
          const key = toDateKey(d);
          const n = countByKey.get(key) ?? 0;
          const dow = d.getDay();
          return (
            <button
              key={key}
              role="listitem"
              className={`date-chip ${n ? 'has-items' : ''} ${dow === 0 || dow === 6 ? 'is-weekend' : ''}`}
              disabled={!n}
              onClick={() => jump(key)}
              title={`${dayLabel(d)} · ${n} ${n === 1 ? 'task' : 'tasks'}`}
            >
              <span className="date-chip-dow">{d.toLocaleDateString([], { weekday: 'short' })}</span>
              <span className="date-chip-num">{d.getDate()}</span>
              <span className="date-chip-dots">
                {Array.from({ length: Math.min(n, 3) }).map((__, j) => (
                  <i key={j} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="list-summary">
        <CalendarClock size={13} />
        {total} upcoming {total === 1 ? 'task' : 'tasks'} across {groups.length} {groups.length === 1 ? 'day' : 'days'}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Telescope}
          title={searchQuery ? 'Nothing upcoming matches' : 'A clear horizon'}
          description={searchQuery ? `No future tasks mention “${searchQuery}”.` : 'Tasks with a due date after today appear here, grouped by day.'}
        />
      ) : (
        groups.map(([key, list]) => {
          const d = new Date(list[0].dueAt!);
          const diff = dayDiff(d, now);
          return (
            <section key={key} id={`day-${key}`} className="day-group">
              <header className={`day-group-head ${diff === 1 ? 'is-tomorrow' : ''}`}>
                <h3>{dayLabel(d, now)}</h3>
                <span className="t-meta">
                  {diff > 1 && diff < 7 ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : diff >= 7 ? `in ${diff} days` : ''}
                </span>
                <span className="count">{list.length}</span>
              </header>
              <div className="task-list">
                {list.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onToggleComplete={actions.onToggleComplete}
                    onEdit={actions.onEdit}
                    onDelete={actions.onDelete}
                    onAddReminder={actions.onAddReminder}
                    onReschedule={actions.onReschedule}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};
