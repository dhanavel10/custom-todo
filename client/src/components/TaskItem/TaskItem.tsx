import { useState } from 'react';
import { Bell, Pencil, Trash2, AlarmClock, CalendarClock, AlignLeft, Ellipsis, Sparkles } from 'lucide-react';
import type { Task } from '../../types';
import { AITag, Button, CategoryTag, DueTag, IconButton, Menu, MenuItem, MenuSep, PriorityBars, QuadrantTag, RescheduleMenu, TaskCheck } from '../ui';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddReminder?: (task: Task) => void;
  onSnooze?: (task: Task) => void;
  onReschedule?: (taskId: string, iso: string | null) => void;
  /** Show "3d 4h overdue" instead of the due date */
  emphasizeOverdue?: boolean;
  /** Hide the quadrant chip (e.g. inside quadrant-specific lists) */
  hideQuadrant?: boolean;
  density?: 'comfortable' | 'compact';
  /** Render reschedule as a visible labelled button instead of a hover icon */
  prominentReschedule?: boolean;
}

/** The canonical task row used by every list view. */
export const TaskItem = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onAddReminder,
  onSnooze,
  onReschedule,
  emphasizeOverdue,
  hideQuadrant,
  density = 'comfortable',
  prominentReschedule
}: TaskItemProps) => {
  const isCompleted = task.status === 'COMPLETED';
  const [showWhy, setShowWhy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = !isCompleted && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();

  return (
    <div
      className={`task-row ${density} ${isCompleted ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''} ${menuOpen ? 'is-menu-open' : ''}`}
      data-q={task.eisenhowerQuadrant}
      onClick={() => onEdit(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') onEdit(task);
      }}
    >
      <span className="task-row-accent" aria-hidden="true" />
      <TaskCheck checked={isCompleted} onToggle={() => onToggleComplete(task)} quadrant={task.eisenhowerQuadrant} />

      <div className="task-row-main">
        <div className="task-row-title">
          <span className="task-title-text">{task.title}</span>
          {task.status === 'IN_PROGRESS' && <span className="tag tag-teal tag-sm">In progress</span>}
          {task.status === 'ARCHIVED' && <span className="tag tag-slate tag-sm">Archived</span>}
        </div>
        <div className="task-row-meta">
          {!hideQuadrant && <QuadrantTag quadrant={task.eisenhowerQuadrant} size="sm" />}
          <DueTag task={task} size="sm" showOverdueBy={emphasizeOverdue} />
          <CategoryTag category={task.category} size="sm" />
          {task.priority && !task.eisenhowerQuadrant && <PriorityBars priority={task.priority} />}
          {task.aiAnalysis && (
            <AITag
              source={task.aiAnalysis.source}
              active={showWhy}
              onClick={(e) => {
                e.stopPropagation();
                setShowWhy((v) => !v);
              }}
            />
          )}
          {task.description && (
            <span className="task-row-note" title={task.description}>
              <AlignLeft />
            </span>
          )}
        </div>
        {showWhy && task.aiAnalysis && (
          <div className="ai-why" onClick={(e) => e.stopPropagation()}>
            <div className="ai-why-head">
              <Sparkles /> {task.aiAnalysis.model}
              <span className="ai-why-scores t-num">
                U {task.aiAnalysis.urgencyScore}/10 · I {task.aiAnalysis.importanceScore}/10
              </span>
            </div>
            <p>{task.aiAnalysis.reasoning}</p>
          </div>
        )}
      </div>

      <div className="task-row-actions" onClick={(e) => e.stopPropagation()}>
        {onReschedule && !isCompleted && !prominentReschedule && (
          <RescheduleMenu
            current={task.dueAt}
            onPick={(iso) => onReschedule(task.id, iso)}
            trigger={(p) => <IconButton {...p} icon={CalendarClock} label="Reschedule" size="sm" />}
          />
        )}
        {onSnooze && !isCompleted && task.dueAt && <IconButton icon={AlarmClock} label="Snooze 1 day" size="sm" onClick={() => onSnooze(task)} />}
        <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => onEdit(task)} />
        <Menu
          width={200}
          onOpenChange={setMenuOpen}
          trigger={(p) => <IconButton {...p} icon={Ellipsis} label="More" size="sm" />}
        >
          {(close) => (
            <>
              {onAddReminder && (
                <MenuItem
                  icon={Bell}
                  onSelect={() => {
                    close();
                    onAddReminder(task);
                  }}
                >
                  Set reminder…
                </MenuItem>
              )}
              <MenuItem
                icon={Pencil}
                onSelect={() => {
                  close();
                  onEdit(task);
                }}
              >
                Edit details
              </MenuItem>
              <MenuSep />
              <MenuItem
                icon={Trash2}
                danger
                onSelect={() => {
                  close();
                  onDelete(task.id);
                }}
              >
                Delete task
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {prominentReschedule && onReschedule && !isCompleted && (
        <div className="task-row-cta" onClick={(e) => e.stopPropagation()}>
          <RescheduleMenu
            current={task.dueAt}
            onPick={(iso) => onReschedule(task.id, iso)}
            trigger={(p) => (
              <Button {...p} size="sm" variant="secondary" icon={CalendarClock}>
                <span className="hide-sm">Reschedule</span>
              </Button>
            )}
          />
        </div>
      )}
    </div>
  );
};
