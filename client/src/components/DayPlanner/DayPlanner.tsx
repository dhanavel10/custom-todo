import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { formatDate } from '../../lib/date';
import type { Task, EisenhowerQuadrant } from '../../types';

interface DayPlannerProps {
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskDate: (taskId: string, dateIso: string | null) => Promise<void>;
  onQuickCreateTask: (title: string, dateIso: string) => Promise<void>;
}

type PlannerViewMode = 'single' | 'week';

export const DayPlanner: React.FC<DayPlannerProps> = ({
  tasks,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onUpdateTaskDate,
  onQuickCreateTask
}) => {
  // Selected reference date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [viewMode, setViewMode] = useState<PlannerViewMode>('single');
  const [inlineTitle, setInlineTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Helper to format date keys: YYYY-MM-DD in local time
  const toDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const selectedKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  // Group tasks by their local due date key YYYY-MM-DD
  const { tasksByDay, unscheduledTasks } = useMemo(() => {
    const map = new Map<string, Task[]>();
    const unscheduled: Task[] = [];

    for (const task of tasks) {
      if (task.status === 'ARCHIVED') continue;
      if (!task.dueAt) {
        unscheduled.push(task);
        continue;
      }

      const d = new Date(task.dueAt);
      if (isNaN(d.getTime())) {
        unscheduled.push(task);
        continue;
      }

      const key = toDateKey(d);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(task);
    }

    return { tasksByDay: map, unscheduledTasks: unscheduled };
  }, [tasks]);

  // Generate 7-day ribbon array centered/starting around the selected week
  const ribbonDays = useMemo(() => {
    const days: { date: Date; key: string; label: string; dayName: string; count: number }[] = [];
    const base = new Date(selectedDate);
    // Show 7 days: selectedDate - 2 days to selectedDate + 4 days, or from selectedDate
    base.setDate(base.getDate() - 1);

    for (let i = 0; i < 7; i++) {
      const cur = new Date(base);
      cur.setDate(base.getDate() + i);
      const key = toDateKey(cur);
      const isToday = key === todayKey;

      const dayName = isToday
        ? 'Today'
        : cur.toLocaleDateString([], { weekday: 'short' });
      const label = cur.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const dayTasks = tasksByDay.get(key) || [];
      const pendingCount = dayTasks.filter((t) => t.status !== 'COMPLETED').length;

      days.push({
        date: cur,
        key,
        label,
        dayName,
        count: pendingCount
      });
    }
    return days;
  }, [selectedDate, todayKey, tasksByDay]);

  // Navigate dates
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - (viewMode === 'week' ? 7 : 1));
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (viewMode === 'week' ? 7 : 1));
    setSelectedDate(next);
  };

  const handleJumpToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  };

  // Quick Inline Add for selected date
  const handleInlineSubmit = async (e: React.FormEvent, targetDateKey?: string) => {
    e.preventDefault();
    if (!inlineTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const key = targetDateKey || selectedKey;
      const [y, m, d] = key.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d, 18, 0, 0); // 6:00 PM default on that date
      await onQuickCreateTask(inlineTitle.trim(), dateObj.toISOString());
      setInlineTitle('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reschedule actions
  const handleMoveToDay = async (taskId: string, targetDaysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + targetDaysOffset);
    target.setHours(18, 0, 0, 0);
    await onUpdateTaskDate(taskId, target.toISOString());
  };

  const handleSetCustomDate = async (taskId: string, dateString: string) => {
    if (!dateString) return;
    const [y, m, d] = dateString.split('-').map(Number);
    const target = new Date(y, m - 1, d, 18, 0, 0);
    await onUpdateTaskDate(taskId, target.toISOString());
  };

  // Tasks for single day view
  const currentDayTasks = tasksByDay.get(selectedKey) || [];
  const completedCount = currentDayTasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = currentDayTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Split day's tasks into categories
  const urgentTasks = currentDayTasks.filter(
    (t) => t.status !== 'COMPLETED' && (t.eisenhowerQuadrant === 'DO_FIRST' || t.priority === 'URGENT')
  );
  const scheduledTasks = currentDayTasks.filter(
    (t) =>
      t.status !== 'COMPLETED' &&
      t.eisenhowerQuadrant !== 'DO_FIRST' &&
      t.priority !== 'URGENT'
  );
  const completedTasks = currentDayTasks.filter((t) => t.status === 'COMPLETED');

  const getQuadrantBadge = (q?: EisenhowerQuadrant) => {
    switch (q) {
      case 'DO_FIRST':
        return <span className="badge badge-urgent">Q1: Do First</span>;
      case 'SCHEDULE':
        return <span className="badge badge-high">Q2: Schedule</span>;
      case 'DELEGATE':
        return <span className="badge badge-medium">Q3: Delegate</span>;
      case 'ELIMINATE':
        return <span className="badge">Q4: Eliminate</span>;
      default:
        return null;
    }
  };

  return (
    <div className="day-planner-container">
      {/* Top Header Bar */}
      <div className="day-planner-header">
        <div className="day-planner-nav-row">
          <div className="day-nav-controls">
            <button className="btn btn-ghost btn-sm" onClick={handlePrevDay} title="Previous">
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleJumpToday}>
              Today
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleNextDay} title="Next">
              <ChevronRight size={16} />
            </button>

            <span className="current-date-title">
              {selectedDate.toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
              {selectedKey === todayKey && <span className="today-chip">Today</span>}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* View Switcher */}
            <div className="view-mode-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
                onClick={() => setViewMode('single')}
              >
                Day Breakdown
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                7-Day Split
              </button>
            </div>

            {/* Jump to Date Input */}
            <input
              type="date"
              className="input date-picker-input"
              value={selectedKey}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setSelectedDate(new Date(y, m - 1, d));
                }
              }}
              title="Pick a specific date"
            />

            {/* Toggle Unscheduled */}
            <button
              className={`btn btn-sm ${showUnscheduled ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowUnscheduled(!showUnscheduled)}
            >
              <Clock size={13} />
              <span>Unscheduled ({unscheduledTasks.length})</span>
            </button>
          </div>
        </div>

        {/* 7-Day Ribbon Strip */}
        <div className="day-ribbon">
          {ribbonDays.map((d) => {
            const isSelected = d.key === selectedKey;
            const isToday = d.key === todayKey;

            return (
              <button
                key={d.key}
                className={`ribbon-item ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
                onClick={() => setSelectedDate(d.date)}
              >
                <div className="ribbon-day-name">{d.dayName}</div>
                <div className="ribbon-date-num">{d.date.getDate()}</div>
                <div className="ribbon-meta">
                  {d.count > 0 ? (
                    <span className="ribbon-count-badge">{d.count} tasks</span>
                  ) : (
                    <span className="ribbon-empty-dash">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="day-planner-body">
        {/* VIEW MODE 1: SINGLE DAY DETAILED BREAKDOWN */}
        {viewMode === 'single' && (
          <div className="single-day-view">
            {/* Day Progress Summary Bar */}
            <div className="day-summary-card">
              <div className="day-summary-header">
                <div>
                  <h2 className="day-title">
                    Tasks for{' '}
                    {selectedDate.toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </h2>
                  <p className="day-subtitle">
                    {totalCount === 0
                      ? 'No tasks scheduled for this day yet.'
                      : `${totalCount} ${totalCount === 1 ? 'task' : 'tasks'} planned • ${completedCount} completed (${progressPercent}%)`}
                  </p>
                </div>

                {totalCount > 0 && (
                  <div className="day-progress-wrap">
                    <div className="day-progress-bar">
                      <div className="day-progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className="day-progress-text">{progressPercent}%</span>
                  </div>
                )}
              </div>

              {/* Inline Quick Task Creator for this Day */}
              <form onSubmit={(e) => handleInlineSubmit(e)} className="day-quick-add-form">
                <Plus size={16} className="text-secondary" />
                <input
                  type="text"
                  className="day-quick-add-input"
                  placeholder={`Add a task to complete on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}... [Enter]`}
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!inlineTitle.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Add Task'}
                </button>
              </form>
            </div>

            {/* Day Task Breakdown Lists */}
            {totalCount === 0 ? (
              <div className="empty-state" style={{ padding: '48px 0' }}>
                <CalendarDays size={32} className="empty-state-icon" />
                <div className="empty-state-title">All clear for this day</div>
                <div className="empty-state-desc">
                  Add a task above or drag/schedule one from your unscheduled backlog.
                </div>
              </div>
            ) : (
              <div className="day-sections">
                {/* 1. Urgent & Do First Section */}
                {urgentTasks.length > 0 && (
                  <div className="day-section-group">
                    <div className="day-section-title urgent">
                      <span>Urgent & High Impact ({urgentTasks.length})</span>
                    </div>
                    <div className="day-task-list">
                      {urgentTasks.map((t) => (
                        <PlannerTaskRow
                          key={t.id}
                          task={t}
                          onToggleComplete={onToggleComplete}
                          onEditTask={onEditTask}
                          onDeleteTask={onDeleteTask}
                          onMoveToDay={handleMoveToDay}
                          onSetCustomDate={handleSetCustomDate}
                          getQuadrantBadge={getQuadrantBadge}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Scheduled & Focus Tasks Section */}
                {scheduledTasks.length > 0 && (
                  <div className="day-section-group">
                    <div className="day-section-title">
                      <span>Focus & Scheduled Tasks ({scheduledTasks.length})</span>
                    </div>
                    <div className="day-task-list">
                      {scheduledTasks.map((t) => (
                        <PlannerTaskRow
                          key={t.id}
                          task={t}
                          onToggleComplete={onToggleComplete}
                          onEditTask={onEditTask}
                          onDeleteTask={onDeleteTask}
                          onMoveToDay={handleMoveToDay}
                          onSetCustomDate={handleSetCustomDate}
                          getQuadrantBadge={getQuadrantBadge}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Completed Section */}
                {completedTasks.length > 0 && (
                  <div className="day-section-group">
                    <div className="day-section-title muted">
                      <span>Completed ({completedTasks.length})</span>
                    </div>
                    <div className="day-task-list">
                      {completedTasks.map((t) => (
                        <PlannerTaskRow
                          key={t.id}
                          task={t}
                          onToggleComplete={onToggleComplete}
                          onEditTask={onEditTask}
                          onDeleteTask={onDeleteTask}
                          onMoveToDay={handleMoveToDay}
                          onSetCustomDate={handleSetCustomDate}
                          getQuadrantBadge={getQuadrantBadge}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 2: 7-DAY SPLIT BOARD */}
        {viewMode === 'week' && (
          <div className="week-split-grid">
            {ribbonDays.map((d) => {
              const dayTasks = tasksByDay.get(d.key) || [];
              const isToday = d.key === todayKey;
              const isSelected = d.key === selectedKey;

              return (
                <div
                  key={d.key}
                  className={`week-day-column ${isToday ? 'is-today-col' : ''} ${isSelected ? 'is-selected-col' : ''}`}
                >
                  <div className="week-day-col-header" onClick={() => setSelectedDate(d.date)}>
                    <div>
                      <span className="week-day-col-title">{d.dayName}</span>
                      <span className="week-day-col-date">{d.label}</span>
                    </div>
                    <span className="badge">{dayTasks.length}</span>
                  </div>

                  <div className="week-day-col-tasks">
                    {dayTasks.length === 0 ? (
                      <div className="week-col-empty">No tasks</div>
                    ) : (
                      dayTasks.map((t) => {
                        const isCompleted = t.status === 'COMPLETED';
                        return (
                          <div
                            key={t.id}
                            className={`week-task-card ${isCompleted ? 'completed-card' : ''}`}
                            onClick={() => onEditTask(t)}
                          >
                            <div className="week-task-top">
                              <span
                                className={`checkbox-custom-sm ${isCompleted ? 'checked' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleComplete(t);
                                }}
                              >
                                {isCompleted && <CheckCircle2 size={11} />}
                              </span>
                              <span className={`week-task-title ${isCompleted ? 'completed' : ''}`}>
                                {t.title}
                              </span>
                            </div>

                            <div className="week-task-badges">
                              {t.category && <span className="badge">{t.category}</span>}
                              {t.eisenhowerQuadrant && getQuadrantBadge(t.eisenhowerQuadrant)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* UNSCHEDULED TASKS SIDE DRAWER */}
        {showUnscheduled && (
          <div className="unscheduled-drawer">
            <div className="unscheduled-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} className="text-secondary" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Unscheduled Backlog</span>
                <span className="badge">{unscheduledTasks.length}</span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowUnscheduled(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Tasks with no assigned due date. Click <strong>"Schedule"</strong> to assign them to{' '}
              {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}.
            </p>

            <div className="unscheduled-task-list">
              {unscheduledTasks.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state-title" style={{ fontSize: 13 }}>No unscheduled tasks</div>
                  <div className="empty-state-desc" style={{ fontSize: 11 }}>
                    All your tasks have been scheduled to specific days!
                  </div>
                </div>
              ) : (
                unscheduledTasks.map((t) => (
                  <div key={t.id} className="unscheduled-task-card">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="unscheduled-task-title">{t.title}</div>
                      <div className="item-meta">
                        {t.category && <span className="badge">{t.category}</span>}
                        {t.eisenhowerQuadrant && getQuadrantBadge(t.eisenhowerQuadrant)}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => handleSetCustomDate(t.id, selectedKey)}
                      title={`Schedule for ${selectedKey}`}
                    >
                      Plan for {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Reusable Task Row in Day Planner View
interface PlannerTaskRowProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onMoveToDay: (taskId: string, targetDaysOffset: number) => Promise<void>;
  onSetCustomDate: (taskId: string, dateString: string) => Promise<void>;
  getQuadrantBadge: (q?: EisenhowerQuadrant) => React.ReactNode;
}

const PlannerTaskRow: React.FC<PlannerTaskRowProps> = ({
  task,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onMoveToDay,
  onSetCustomDate,
  getQuadrantBadge
}) => {
  const isCompleted = task.status === 'COMPLETED';

  return (
    <div className={`planner-task-card ${isCompleted ? 'completed-card' : ''}`}>
      <div
        className={`checkbox-custom ${isCompleted ? 'checked' : ''}`}
        onClick={() => onToggleComplete(task)}
      >
        {isCompleted && <CheckCircle2 size={13} />}
      </div>

      <div className="planner-task-info" onClick={() => onEditTask(task)}>
        <div className={`planner-task-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </div>

        <div className="planner-task-meta">
          {task.category && <span className="badge">{task.category}</span>}
          {task.eisenhowerQuadrant && getQuadrantBadge(task.eisenhowerQuadrant)}
          {task.dueAt && (
            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {formatDate(task.dueAt)}
            </span>
          )}
        </div>
      </div>

      {/* Reschedule Shortcuts */}
      <div className="planner-task-actions">
        <select
          className="select select-sm planner-reschedule-select"
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'today') onMoveToDay(task.id, 0);
            else if (val === 'tomorrow') onMoveToDay(task.id, 1);
            else if (val === 'in2days') onMoveToDay(task.id, 2);
            else if (val === 'in3days') onMoveToDay(task.id, 3);
            else if (val === 'clear') onSetCustomDate(task.id, '');
            e.target.value = '';
          }}
          defaultValue=""
          title="Move / Reschedule task"
        >
          <option value="" disabled>Move to...</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="in2days">+2 Days</option>
          <option value="in3days">+3 Days</option>
          <option value="clear">Clear Date</option>
        </select>

        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onDeleteTask(task.id)}
          title="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
