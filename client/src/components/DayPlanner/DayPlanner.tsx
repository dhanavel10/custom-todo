import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Inbox, Trash2, Ellipsis, Pencil, CalendarClock, GripVertical, Sun, Rows3, Columns3, ArrowRight, CalendarCheck } from 'lucide-react';
import type { Task } from '../../types';
import { addDays, formatTime, isSameDay, startOfDay, startOfWeek, toDateKey } from '../../lib/date';
import { quadrantOf } from '../../lib/quadrants';
import { Button, EmptyState, IconButton, Menu, MenuItem, MenuSep, ProgressRing, QuadrantTag, RescheduleMenu, Segmented, TaskCheck } from '../ui';
import './DayPlanner.css';

interface DayPlannerProps {
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskDate: (taskId: string, dateIso: string | null) => Promise<void>;
  onQuickCreateTask: (title: string, dateIso: string) => Promise<void>;
}

type PlannerViewMode = 'day' | 'week';

const DRAG_MIME = 'application/x-task-id';
const HOUR_H = 56; // px per hour
const BLOCK_MIN = 45; // visual block length in minutes (tasks have a due time, not a duration)
const SNAP = 15;
const DEFAULT_HOUR = 18; // same default the planner has always used for date-only scheduling

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
const dayKeyOf = (t: Task) => (t.dueAt ? toDateKey(new Date(t.dueAt)) : null);

/** Assign side-by-side lanes to blocks that overlap in time. */
function layoutBlocks(tasks: Task[]) {
  const items = tasks
    .map((t) => {
      const start = minutesOf(new Date(t.dueAt!));
      return { t, start, end: start + BLOCK_MIN, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);

  let cluster: typeof items = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    for (const it of cluster) it.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const it of items) {
    if (it.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    it.lane = lane;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return items;
}

export const DayPlanner: React.FC<DayPlannerProps> = ({ tasks, onToggleComplete, onEditTask, onDeleteTask, onUpdateTaskDate, onQuickCreateTask }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<PlannerViewMode>('day');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropMin, setDropMin] = useState<number | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const selectedKey = toDateKey(selectedDate);
  const isToday = isSameDay(selectedDate, now);

  const { byDay, backlog } = useMemo(() => {
    const map = new Map<string, Task[]>();
    const unscheduled: Task[] = [];
    for (const t of tasks) {
      if (t.status === 'ARCHIVED') continue;
      const key = dayKeyOf(t);
      if (!key || isNaN(new Date(t.dueAt!).getTime())) {
        if (t.status !== 'COMPLETED') unscheduled.push(t);
        continue;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
    return { byDay: map, backlog: unscheduled };
  }, [tasks]);

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayTasks = useMemo(() => byDay.get(selectedKey) ?? [], [byDay, selectedKey]);
  const doneCount = dayTasks.filter((t) => t.status === 'COMPLETED').length;
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const blocks = useMemo(() => layoutBlocks(dayTasks), [dayTasks]);

  // Scroll the timeline to something useful when the day changes
  useLayoutEffect(() => {
    if (viewMode !== 'day' || !scrollRef.current) return;
    const first = dayTasks[0] ? minutesOf(new Date(dayTasks[0].dueAt!)) / 60 : 8;
    const focusHour = isToday ? Math.min(now.getHours(), first) : first;
    scrollRef.current.scrollTo({ top: Math.max(0, (focusHour - 1) * HOUR_H), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, viewMode]);

  const go = (delta: number) => setSelectedDate((d) => addDays(d, delta * (viewMode === 'week' ? 7 : 1)));

  const scheduleAt = (taskId: string, day: Date, minutes: number) => {
    const d = new Date(day);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    void onUpdateTaskDate(taskId, d.toISOString());
  };

  /** Move to another day, keeping the task's time of day. */
  const moveToDay = (taskId: string, day: Date) => {
    const task = tasks.find((t) => t.id === taskId);
    const mins = task?.dueAt ? minutesOf(new Date(task.dueAt)) : DEFAULT_HOUR * 60;
    scheduleAt(taskId, day, mins);
  };

  const minutesFromPointer = (e: React.DragEvent | React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top + el.scrollTop - 8; // 8px top padding of the grid
    const raw = (y / HOUR_H) * 60;
    return Math.max(0, Math.min(24 * 60 - SNAP, Math.round(raw / SNAP) * SNAP));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    const [h, m] = time.split(':').map(Number);
    const d = new Date(selectedDate);
    d.setHours(h ?? DEFAULT_HOUR, m ?? 0, 0, 0);
    setIsSubmitting(true);
    try {
      await onQuickCreateTask(title.trim(), d.toISOString());
      setTitle('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dragProps = (t: Task) => ({
    draggable: t.status !== 'COMPLETED',
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_MIME, t.id);
      e.dataTransfer.effectAllowed = 'move';
      setDragId(t.id);
    },
    onDragEnd: () => {
      setDragId(null);
      setDropMin(null);
      setDropDay(null);
    }
  });

  const dayDropProps = (day: Date) => {
    const key = toDateKey(day);
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        if (dropDay !== key) setDropDay(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDay((k) => (k === key ? null : k));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(DRAG_MIME);
        setDropDay(null);
        setDragId(null);
        if (id) moveToDay(id, day);
      }
    };
  };

  const taskMenu = (t: Task) => (
    <Menu width={210} trigger={(p) => <IconButton {...p} icon={Ellipsis} label="More" size="sm" />}>
      {(close) => (
        <>
          <MenuItem
            icon={Pencil}
            onSelect={() => {
              close();
              onEditTask(t);
            }}
          >
            Edit details
          </MenuItem>
          <MenuItem
            icon={Inbox}
            onSelect={() => {
              close();
              void onUpdateTaskDate(t.id, null);
            }}
          >
            Move to backlog
          </MenuItem>
          <MenuSep />
          <MenuItem
            icon={Trash2}
            danger
            onSelect={() => {
              close();
              onDeleteTask(t.id);
            }}
          >
            Delete
          </MenuItem>
        </>
      )}
    </Menu>
  );

  /* ---------- Header ---------- */
  const header = (
    <div className="planner-head">
      <div className="planner-date">
        <span className="planner-dow">
          {viewMode === 'week'
            ? `${weekDays[0].toLocaleDateString([], { month: 'long' })}${weekDays[6].getMonth() !== weekDays[0].getMonth() ? ` – ${weekDays[6].toLocaleDateString([], { month: 'long' })}` : ''}`
            : selectedDate.toLocaleDateString([], { weekday: 'long' })}
        </span>
        <span className="planner-full">
          {viewMode === 'week'
            ? `Week of ${weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}`
            : selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          {isToday && viewMode === 'day' && <span className="tag tag-primary tag-sm">Today</span>}
        </span>
      </div>
      <div className="planner-controls">
        <div className="planner-nav">
          <IconButton icon={ChevronLeft} label={viewMode === 'week' ? 'Previous week' : 'Previous day'} onClick={() => go(-1)} />
          <Button size="sm" variant="ghost" icon={Sun} onClick={() => setSelectedDate(startOfDay(new Date()))} disabled={isToday}>
            Today
          </Button>
          <IconButton icon={ChevronRight} label={viewMode === 'week' ? 'Next week' : 'Next day'} onClick={() => go(1)} />
          <label className="date-jump" data-tip="Jump to date">
            <CalendarDays />
            <input
              type="date"
              value={selectedKey}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }}
              aria-label="Jump to date"
            />
          </label>
        </div>
        <Segmented
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          items={[
            { value: 'day', label: 'Day', icon: Rows3 },
            { value: 'week', label: 'Week', icon: Columns3 }
          ]}
        />
      </div>
    </div>
  );

  /* ---------- Week strip ---------- */
  const strip = (
    <div className="week-strip">
      {weekDays.map((d) => {
        const key = toDateKey(d);
        const list = byDay.get(key) ?? [];
        const open = list.filter((t) => t.status !== 'COMPLETED').length;
        const done = list.length - open;
        return (
          <button
            key={key}
            className={`ws-day ${key === selectedKey ? 'is-selected' : ''} ${isSameDay(d, now) ? 'is-today' : ''} ${dropDay === key ? 'is-drop' : ''} ${d < startOfDay(now) ? 'is-past' : ''}`}
            onClick={() => {
              setSelectedDate(d);
              if (viewMode === 'week') setViewMode('day');
            }}
            {...dayDropProps(d)}
          >
            <span className="ws-dow">{d.toLocaleDateString([], { weekday: 'short' })}</span>
            <span className="ws-num">{d.getDate()}</span>
            <span className="ws-load" aria-label={`${open} open, ${done} done`}>
              {Array.from({ length: Math.min(list.length, 4) }).map((_, i) => (
                <i key={i} className={i < done ? 'done' : ''} />
              ))}
              {list.length > 4 && <em>+{list.length - 4}</em>}
            </span>
          </button>
        );
      })}
    </div>
  );

  /* ---------- Backlog ---------- */
  const backlogPanel = (
    <section className="planner-panel backlog">
      <div className="panel-head">
        <h3>
          <Inbox /> Backlog
        </h3>
        <span className="count">{backlog.length}</span>
      </div>
      <p className="backlog-hint">Unscheduled tasks. Drag one onto the timeline or a day, or plan it for {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}.</p>
      {backlog.length === 0 ? (
        <EmptyState compact icon={CalendarCheck} tone="var(--green)" title="Everything is scheduled" />
      ) : (
        <div className="backlog-list">
          {backlog.map((t) => (
            <div key={t.id} className={`backlog-card ${dragId === t.id ? 'is-dragging' : ''}`} style={{ ['--q' as string]: quadrantOf(t.eisenhowerQuadrant)?.color ?? 'var(--border-strong)' }} {...dragProps(t)}>
              <GripVertical className="grip" />
              <div className="backlog-main" onClick={() => onEditTask(t)}>
                <span className="backlog-title">{t.title}</span>
                <QuadrantTag quadrant={t.eisenhowerQuadrant} size="sm" />
              </div>
              <IconButton icon={ArrowRight} label={`Plan for ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`} size="sm" tipPos="left" onClick={() => scheduleAt(t.id, selectedDate, DEFAULT_HOUR * 60)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );

  /* ---------- Day view ---------- */
  const nowTop = (minutesOf(now) / 60) * HOUR_H;

  const dayView = (
    <div className="planner-day">
      <div className="timeline-card">
        <div
          className={`timeline ${dragId ? 'is-dragging' : ''}`}
          ref={scrollRef}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
            e.preventDefault();
            const m = minutesFromPointer(e);
            if (m !== dropMin) setDropMin(m);
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropMin(null)}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData(DRAG_MIME);
            const m = minutesFromPointer(e);
            setDropMin(null);
            setDragId(null);
            if (id) scheduleAt(id, selectedDate, m);
          }}
        >
          <div className="timeline-grid" style={{ height: 24 * HOUR_H }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className={`hour ${isToday && h < now.getHours() ? 'is-past' : ''}`}
                style={{ top: h * HOUR_H, height: HOUR_H }}
                onClick={() => {
                  setTime(`${String(h).padStart(2, '0')}:00`);
                  addInputRef.current?.focus();
                }}
                title={`Add a task at ${hourLabel(h)}`}
              >
                <span className="hour-label">{h === 0 ? '' : hourLabel(h)}</span>
              </div>
            ))}

            {isToday && (
              <div className="now-line" style={{ top: nowTop }} aria-label={`Now, ${formatTime(now)}`}>
                <span>{formatTime(now)}</span>
              </div>
            )}

            {dropMin !== null && (
              <div className="drop-ghost" style={{ top: (dropMin / 60) * HOUR_H, height: (BLOCK_MIN / 60) * HOUR_H }}>
                <span>{formatTime(new Date(2000, 0, 1, Math.floor(dropMin / 60), dropMin % 60))}</span>
              </div>
            )}

            {blocks.map(({ t, start, lane, lanes }) => {
              const done = t.status === 'COMPLETED';
              const q = quadrantOf(t.eisenhowerQuadrant);
              const top = Math.min((start / 60) * HOUR_H, 24 * HOUR_H - (BLOCK_MIN / 60) * HOUR_H);
              const overdue = !done && new Date(t.dueAt!) < now;
              return (
                <div
                  key={t.id}
                  className={`block ${done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''} ${dragId === t.id ? 'is-dragging' : ''}`}
                  style={{
                    top,
                    height: (BLOCK_MIN / 60) * HOUR_H - 3,
                    left: `calc(var(--tl-gutter) + (100% - var(--tl-gutter) - 8px) * ${lane / lanes})`,
                    width: `calc((100% - var(--tl-gutter) - 8px) / ${lanes} - 4px)`,
                    ['--q' as string]: q?.color ?? 'var(--primary)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTask(t);
                  }}
                  {...dragProps(t)}
                >
                  <TaskCheck size="sm" checked={done} onToggle={() => onToggleComplete(t)} quadrant={t.eisenhowerQuadrant} />
                  <div className="block-main">
                    <span className="block-title">
                      <span className="task-title-text">{t.title}</span>
                    </span>
                    <span className="block-time">
                      {formatTime(new Date(t.dueAt!))}
                      {t.category ? ` · ${t.category}` : ''}
                    </span>
                  </div>
                  <div className="block-actions" onClick={(e) => e.stopPropagation()}>
                    {taskMenu(t)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="planner-side">
        <section className="planner-panel">
          <div className="day-summary">
            <ProgressRing value={pct} size={56} stroke={6} color={pct === 100 ? 'var(--green)' : undefined} label={`${pct}%`} labelSize={13} />
            <div>
              <div className="t-section">{dayTasks.length === 0 ? 'Open day' : `${doneCount} of ${dayTasks.length} done`}</div>
              <div className="t-caption">
                {dayTasks.length === 0 ? 'Nothing scheduled yet.' : `${dayTasks.length - doneCount} remaining${isToday ? ' today' : ''}`}
              </div>
            </div>
          </div>
          <form id="planner-add" onSubmit={submit} className="inline-add" style={{ marginTop: 14 }}>
            <Plus className="inline-add-icon" />
            <input ref={addInputRef} className="inline-add-input" placeholder={`Add to ${isToday ? 'today' : selectedDate.toLocaleDateString([], { weekday: 'short' })}…`} value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} aria-label="New task title" />
            <input type="time" className="input input-sm inline-add-time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          </form>
          <div className="quick-add-foot">
            <span className="t-meta">Tip: click an hour on the timeline to prefill the time.</span>
            <Button type="submit" form="planner-add" size="sm" variant="primary" disabled={!title.trim()} loading={isSubmitting}>
              Add task
            </Button>
          </div>
        </section>

        {dayTasks.length > 0 && (
          <section className="planner-panel">
            <div className="panel-head">
              <h3>
                <CalendarClock /> Move day
              </h3>
            </div>
            <div className="move-list">
              {dayTasks
                .filter((t) => t.status !== 'COMPLETED')
                .slice(0, 6)
                .map((t) => (
                  <div key={t.id} className="move-row">
                    <span className="move-dot" style={{ background: quadrantOf(t.eisenhowerQuadrant)?.color ?? 'var(--text-3)' }} />
                    <span className="move-title">{t.title}</span>
                    <RescheduleMenu current={t.dueAt} onPick={(iso) => void onUpdateTaskDate(t.id, iso)} title="Move to" trigger={(p) => <IconButton {...p} icon={CalendarClock} label="Reschedule" size="sm" tipPos="left" />} />
                  </div>
                ))}
            </div>
          </section>
        )}

        {backlogPanel}
      </aside>
    </div>
  );

  /* ---------- Week view ---------- */
  const weekView = (
    <div className="planner-week-wrap">
      <div className="week-board">
        {weekDays.map((d) => {
          const key = toDateKey(d);
          const list = byDay.get(key) ?? [];
          const today = isSameDay(d, now);
          return (
            <section key={key} className={`week-col ${today ? 'is-today' : ''} ${dropDay === key ? 'is-drop' : ''} ${d < startOfDay(now) ? 'is-past' : ''}`} {...dayDropProps(d)}>
              <button
                className="week-col-head"
                onClick={() => {
                  setSelectedDate(d);
                  setViewMode('day');
                }}
              >
                <span className="ws-dow">{d.toLocaleDateString([], { weekday: 'short' })}</span>
                <span className="week-col-num">{d.getDate()}</span>
                {list.length > 0 && <span className="count">{list.length}</span>}
              </button>
              <div className="week-col-body">
                {list.length === 0 ? (
                  <div className="week-free">Free</div>
                ) : (
                  list.map((t) => {
                    const done = t.status === 'COMPLETED';
                    return (
                      <div
                        key={t.id}
                        className={`week-card ${done ? 'is-done' : ''} ${dragId === t.id ? 'is-dragging' : ''}`}
                        style={{ ['--q' as string]: quadrantOf(t.eisenhowerQuadrant)?.color ?? 'var(--border-strong)' }}
                        onClick={() => onEditTask(t)}
                        {...dragProps(t)}
                      >
                        <TaskCheck size="sm" checked={done} onToggle={() => onToggleComplete(t)} quadrant={t.eisenhowerQuadrant} />
                        <div className="week-card-main">
                          <span className="week-card-time">{formatTime(new Date(t.dueAt!))}</span>
                          <span className="week-card-title">
                            <span className="task-title-text">{t.title}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
      {backlogPanel}
    </div>
  );

  return (
    <div className="planner view-enter">
      {header}
      {strip}
      {viewMode === 'day' ? dayView : weekView}
    </div>
  );
};
