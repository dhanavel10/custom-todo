import { useMemo, useState } from 'react';
import { ListTodo, Hash, ArrowDownWideNarrow, SearchX } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { EmptyState, Segmented, Menu, MenuItem, MenuLabel, Button } from '../components/ui';
import { TaskItem } from '../components/TaskItem/TaskItem';
import { byDue, byImportance, type TaskActions } from './types';

type StatusFilter = 'ALL' | Exclude<TaskStatus, 'INBOX'>;
type SortKey = 'newest' | 'due' | 'priority';

interface Props extends TaskActions {
  tasks: Task[];
  searchQuery: string;
  statusFilter: string;
  onStatusFilter: (s: string) => void;
}

const SORTS: Record<SortKey, { label: string; fn: (a: Task, b: Task) => number }> = {
  newest: { label: 'Newest first', fn: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() },
  due: { label: 'Due date', fn: byDue },
  priority: { label: 'Priority', fn: byImportance }
};

export const AllTasksView = ({ tasks, searchQuery, statusFilter, onStatusFilter, ...actions }: Props) => {
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');

  const counts = useMemo(() => {
    const c = { ALL: tasks.length, TODO: 0, IN_PROGRESS: 0, COMPLETED: 0, ARCHIVED: 0 } as Record<string, number>;
    for (const t of tasks) if (t.status in c) c[t.status]++;
    return c;
  }, [tasks]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) if (t.category) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  const list = useMemo(
    () =>
      tasks
        .filter((t) => (statusFilter === 'ALL' ? true : t.status === statusFilter))
        .filter((t) => (category ? t.category === category : true))
        .sort(SORTS[sort].fn),
    [tasks, statusFilter, category, sort]
  );

  const filter = statusFilter as StatusFilter;

  return (
    <div className="view-enter">
      <div className="toolbar">
        <Segmented
          ariaLabel="Filter by status"
          value={filter}
          onChange={(v) => onStatusFilter(v)}
          items={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'TODO', label: 'To do', count: counts.TODO },
            { value: 'IN_PROGRESS', label: 'In progress', count: counts.IN_PROGRESS },
            { value: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
            { value: 'ARCHIVED', label: 'Archived', count: counts.ARCHIVED }
          ]}
        />
        <div className="toolbar-right">
          <Menu
            align="end"
            trigger={(p) => (
              <Button {...p} size="sm" variant="ghost" icon={ArrowDownWideNarrow}>
                {SORTS[sort].label}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Sort by</MenuLabel>
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <MenuItem
                    key={k}
                    selected={k === sort}
                    onSelect={() => {
                      setSort(k);
                      close();
                    }}
                  >
                    {SORTS[k].label}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="filter-chips" style={{ marginBottom: 16 }} role="group" aria-label="Filter by category">
          <button className={`chip ${!category ? 'is-active' : ''}`} onClick={() => setCategory(null)}>
            All categories
          </button>
          {categories.map(([c, n]) => (
            <button key={c} className={`chip ${category === c ? 'is-active' : ''}`} onClick={() => setCategory(category === c ? null : c)}>
              <Hash />
              {c}
              <span className="muted t-num">{n}</span>
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={searchQuery || category ? SearchX : ListTodo}
          title={searchQuery || category ? 'No tasks match these filters' : filter === 'ALL' ? 'No tasks yet' : `No ${filter.replace('_', ' ').toLowerCase()} tasks`}
          description={searchQuery || category ? 'Try clearing the search or picking another category.' : 'Press Ctrl+K to capture your first task.'}
          action={
            category ? (
              <Button size="sm" variant="secondary" onClick={() => setCategory(null)}>
                Clear category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="task-list">
          {list.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggleComplete={actions.onToggleComplete}
              onEdit={actions.onEdit}
              onDelete={actions.onDelete}
              onAddReminder={actions.onAddReminder}
              onSnooze={actions.onSnooze}
              onReschedule={actions.onReschedule}
            />
          ))}
        </div>
      )}
    </div>
  );
};
