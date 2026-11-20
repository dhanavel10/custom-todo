import type { Task } from '../types';

/** Task actions every list view receives from App. */
export interface TaskActions {
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddReminder: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onReschedule: (taskId: string, iso: string | null) => void;
}

export const QUADRANT_RANK: Record<string, number> = { DO_FIRST: 0, SCHEDULE: 1, DELEGATE: 2, ELIMINATE: 3 };
export const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const byDue = (a: Task, b: Task) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity);

export const byImportance = (a: Task, b: Task) =>
  (QUADRANT_RANK[a.eisenhowerQuadrant ?? ''] ?? 4) - (QUADRANT_RANK[b.eisenhowerQuadrant ?? ''] ?? 4) ||
  (PRIORITY_RANK[a.priority ?? ''] ?? 4) - (PRIORITY_RANK[b.priority ?? ''] ?? 4) ||
  byDue(a, b);

export const isOpen = (t: Task) => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED';
