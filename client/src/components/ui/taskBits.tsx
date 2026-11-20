import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarClock, Sparkles, Hash, Sunrise, Sun, Moon, CalendarPlus, CalendarX, CalendarDays, Clock } from 'lucide-react';
import type { EisenhowerQuadrant, Task, TaskPriority } from '../../types';
import { quadrantOf } from '../../lib/quadrants';
import { addDays, formatDueShort, formatOverdueBy, startOfDay, toLocalInput } from '../../lib/date';
import { Menu, MenuItem, MenuLabel, MenuSep, type MenuTriggerProps } from './overlays';
import { Button } from './primitives';

/* ---------------- Animated completion check ---------------- */

export const TaskCheck = ({
  checked,
  onToggle,
  quadrant,
  size,
  label
}: {
  checked: boolean;
  onToggle: () => void;
  quadrant?: EisenhowerQuadrant;
  size?: 'sm';
  label?: string;
}) => {
  const [completing, setCompleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const trigger = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (completing) return;
    if (checked) {
      onToggle();
      return;
    }
    // Let the check animation play before the row moves/disappears
    setCompleting(true);
    timer.current = setTimeout(() => {
      setCompleting(false);
      onToggle();
    }, 420);
  };

  return (
    <span
      role="checkbox"
      aria-checked={checked || completing}
      aria-label={label ?? (checked ? 'Mark as not done' : 'Mark as done')}
      tabIndex={0}
      data-q={quadrant}
      className={`check ${size ?? ''} ${checked ? 'is-checked' : ''} ${completing ? 'is-completing' : ''}`}
      onClick={trigger}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          trigger(e);
        }
      }}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.3 5 8.6l4.6-5.1" />
      </svg>
    </span>
  );
};

/* ---------------- Tags ---------------- */

export const QuadrantTag = ({ quadrant, short, size }: { quadrant?: EisenhowerQuadrant; short?: boolean; size?: 'sm' }) => {
  const q = quadrantOf(quadrant);
  if (!q) return null;
  return (
    <span className={`tag tag-dot ${q.tagClass} ${size === 'sm' ? 'tag-sm' : ''}`} title={`${q.code} · ${q.tagline}`}>
      <span>{short ? q.code : q.name}</span>
    </span>
  );
};

export const CategoryTag = ({ category, size }: { category?: string | null; size?: 'sm' }) =>
  category ? (
    <span className={`tag tag-outline ${size === 'sm' ? 'tag-sm' : ''}`} title="Category">
      <Hash />
      <span>{category}</span>
    </span>
  ) : null;

export const DueTag = ({ task, size, showOverdueBy }: { task: Pick<Task, 'dueAt' | 'status' | 'isDeadline'>; size?: 'sm'; showOverdueBy?: boolean }) => {
  if (!task.dueAt) return null;
  const done = task.status === 'COMPLETED';
  const due = new Date(task.dueAt);
  const overdue = !done && due.getTime() < Date.now();
  const isToday = startOfDay(due).getTime() === startOfDay(new Date()).getTime();
  const tone = overdue ? 'tag-coral' : isToday && !done ? 'tag-amber' : '';
  return (
    <span
      className={`tag ${tone} ${size === 'sm' ? 'tag-sm' : ''}`}
      title={`${task.isDeadline ? 'Hard deadline' : 'Due'} · ${due.toLocaleString()}`}
    >
      <CalendarClock />
      <span>
        {overdue && showOverdueBy ? `${formatOverdueBy(task.dueAt)} overdue` : formatDueShort(task.dueAt)}
        {task.isDeadline ? ' · deadline' : ''}
      </span>
    </span>
  );
};

export const AITag = ({ source, onClick, active }: { source: string; onClick?: (e: React.MouseEvent) => void; active?: boolean }) => {
  const label = source === 'ollama' ? 'AI' : 'NLP';
  const content = (
    <>
      <Sparkles />
      <span>{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={`tag tag-ai tag-sm ${active ? 'is-active' : ''}`} onClick={onClick} aria-expanded={active} title="Show AI reasoning">
      {content}
    </button>
  ) : (
    <span className="tag tag-ai tag-sm">{content}</span>
  );
};

const PRIO_LEVEL: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
export const PriorityBars = ({ priority }: { priority: TaskPriority }) => {
  if (!priority) return null;
  const level = PRIO_LEVEL[priority] ?? 0;
  return (
    <span className="prio" data-level={level} title={`${priority.charAt(0)}${priority.slice(1).toLowerCase()} priority`} aria-label={`${priority} priority`}>
      <i />
      <i />
      <i />
    </span>
  );
};

/* ---------------- Reschedule menu ---------------- */

function at(d: Date, h: number, m = 0) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}

export function reschedulePresets(now = new Date()) {
  const today = startOfDay(now);
  const laterToday = new Date(now.getTime() + 3 * 3600_000);
  laterToday.setMinutes(0, 0, 0);
  const dow = today.getDay(); // 0 Sun
  const daysToSat = (6 - dow + 7) % 7 || 7;
  const daysToMon = (8 - dow) % 7 || 7;
  const presets = [
    { key: 'later', label: 'Later today', icon: Sun, date: laterToday, show: laterToday.getDate() === now.getDate() },
    { key: 'evening', label: 'This evening', icon: Moon, date: at(today, 19), show: now.getHours() < 18 },
    { key: 'tomorrow', label: 'Tomorrow', icon: Sunrise, date: at(addDays(today, 1), 9), show: true },
    { key: 'weekend', label: 'This weekend', icon: CalendarDays, date: at(addDays(today, daysToSat), 10), show: dow !== 6 && dow !== 0 },
    { key: 'nextweek', label: 'Next week', icon: CalendarPlus, date: at(addDays(today, daysToMon), 9), show: true }
  ];
  return presets.filter((p) => p.show);
}

const fmtHint = (d: Date) => {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return t;
  if (diff < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${t}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const RescheduleMenu = ({
  current,
  onPick,
  trigger,
  allowClear = true,
  title = 'Reschedule'
}: {
  current?: string | null;
  onPick: (iso: string | null) => void;
  trigger: (p: MenuTriggerProps) => ReactNode;
  allowClear?: boolean;
  title?: string;
}) => {
  const [custom, setCustom] = useState('');
  return (
    <Menu
      width={250}
      trigger={trigger}
      onOpenChange={(o) => {
        if (o) {
          const base = current ? new Date(current) : at(addDays(new Date(), 1), 9);
          setCustom(toLocalInput(base));
        }
      }}
    >
      {(close) => (
        <>
          <MenuLabel>{title}</MenuLabel>
          {reschedulePresets().map((p) => (
            <MenuItem
              key={p.key}
              icon={p.icon}
              hint={fmtHint(p.date)}
              onSelect={() => {
                onPick(p.date.toISOString());
                close();
              }}
            >
              {p.label}
            </MenuItem>
          ))}
          <MenuSep />
          <form
            className="menu-custom"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom) return;
              onPick(new Date(custom).toISOString());
              close();
            }}
          >
            <input type="datetime-local" className="input input-sm" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom date and time" />
            <Button type="submit" size="sm" variant="primary" icon={Clock} aria-label="Set custom time" />
          </form>
          {allowClear && current && (
            <>
              <MenuSep />
              <MenuItem
                icon={CalendarX}
                onSelect={() => {
                  onPick(null);
                  close();
                }}
              >
                Remove date
              </MenuItem>
            </>
          )}
        </>
      )}
    </Menu>
  );
};
