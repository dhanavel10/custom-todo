import { Check, Calendar, Bell, Edit3, Trash2, Clock } from 'lucide-react';
import { formatDate, isOverdue } from '../../lib/date';
import type { Task } from '../../types';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddReminder: (task: Task) => void;
  onSnooze?: (task: Task) => void;
}

export const TaskItem = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onAddReminder,
  onSnooze
}: TaskItemProps) => {
  const isCompleted = task.status === 'COMPLETED';
  const overdue = !isCompleted && isOverdue(task.dueAt);

  return (
    <div className={`item-card ${isCompleted ? 'completed-card' : ''}`}>
      <div
        className={`checkbox-custom ${isCompleted ? 'checked' : ''}`}
        onClick={() => onToggleComplete(task)}
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onToggleComplete(task);
          }
        }}
      >
        {isCompleted && <Check size={12} strokeWidth={3} />}
      </div>

      <div className="item-content" onClick={() => onEdit(task)} style={{ cursor: 'pointer' }}>
        <div className={`item-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </div>

        <div className="item-meta">
          {task.category && (
            <span className="badge" style={{ textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 600 }}>
              {task.category}
            </span>
          )}

          {task.eisenhowerQuadrant && (
            <span
              className={`badge ${
                task.eisenhowerQuadrant === 'DO_FIRST'
                  ? 'badge-urgent'
                  : task.eisenhowerQuadrant === 'SCHEDULE'
                  ? 'badge-high'
                  : ''
              }`}
              style={{ fontSize: '0.7rem' }}
            >
              {task.eisenhowerQuadrant === 'DO_FIRST' && 'Q1: Do First'}
              {task.eisenhowerQuadrant === 'SCHEDULE' && 'Q2: Schedule'}
              {task.eisenhowerQuadrant === 'DELEGATE' && 'Q3: Delegate'}
              {task.eisenhowerQuadrant === 'ELIMINATE' && 'Q4: Eliminate'}
            </span>
          )}

          {task.dueAt && (
            <span
              className={`badge ${overdue ? 'badge-overdue' : ''} ${task.isDeadline ? 'badge-urgent' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={task.isDeadline ? 'Confirmed completion deadline' : 'Mentioned date'}
            >
              <Calendar size={11} />
              {formatDate(task.dueAt)}
              {task.isDeadline ? ' (Deadline)' : ''}
              {overdue ? ' · Overdue' : ''}
            </span>
          )}

          {task.priority && !task.eisenhowerQuadrant && (
            <span
              className={`badge ${
                task.priority === 'URGENT'
                  ? 'badge-urgent'
                  : task.priority === 'HIGH'
                  ? 'badge-high'
                  : ''
              }`}
            >
              {task.priority}
            </span>
          )}

          {task.description && (
            <span style={{ color: 'var(--text-muted)' }}>Has notes</span>
          )}
        </div>
      </div>

      <div className="item-actions">
        {onSnooze && !isCompleted && task.dueAt && (
          <button
            className="btn btn-ghost btn-icon"
            title="Snooze 1 day"
            onClick={() => onSnooze(task)}
          >
            <Clock size={13} />
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon"
          title="Set Reminder"
          onClick={() => onAddReminder(task)}
        >
          <Bell size={13} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title="Edit"
          onClick={() => onEdit(task)}
        >
          <Edit3 size={13} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title="Delete"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 size={13} style={{ color: 'var(--danger)' }} />
        </button>
      </div>
    </div>
  );
};
