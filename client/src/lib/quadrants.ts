import { Zap, CalendarRange, Forward, Wind, type LucideIcon } from 'lucide-react';
import type { EisenhowerQuadrant } from '../types';

export interface QuadrantMeta {
  key: EisenhowerQuadrant;
  n: number;
  code: string;
  name: string;
  verb: string;
  urgency: 'Urgent' | 'Not urgent';
  importance: 'Important' | 'Not important';
  tagline: string;
  description: string;
  emptyTitle: string;
  icon: LucideIcon;
  /** CSS custom property holding the quadrant hue, e.g. var(--q1) */
  color: string;
  soft: string;
  tagClass: string;
}

export const QUADRANTS: QuadrantMeta[] = [
  {
    key: 'DO_FIRST',
    n: 1,
    code: 'Q1',
    name: 'Do First',
    verb: 'Act now',
    urgency: 'Urgent',
    importance: 'Important',
    tagline: 'Urgent and important',
    description: 'Imminent deadlines and high-impact work. Clear these before anything else.',
    emptyTitle: 'Nothing on fire',
    icon: Zap,
    color: 'var(--q1)',
    soft: 'var(--q1-soft)',
    tagClass: 'tag-q1'
  },
  {
    key: 'SCHEDULE',
    n: 2,
    code: 'Q2',
    name: 'Schedule',
    verb: 'Plan it',
    urgency: 'Not urgent',
    importance: 'Important',
    tagline: 'Important, not urgent',
    description: 'Deep work, learning and long-term goals. Block time so they actually happen.',
    emptyTitle: 'Room to plan ahead',
    icon: CalendarRange,
    color: 'var(--q2)',
    soft: 'var(--q2-soft)',
    tagClass: 'tag-q2'
  },
  {
    key: 'DELEGATE',
    n: 3,
    code: 'Q3',
    name: 'Delegate',
    verb: 'Hand off',
    urgency: 'Urgent',
    importance: 'Not important',
    tagline: 'Urgent, not important',
    description: 'Time-sensitive chores and interruptions someone else could handle.',
    emptyTitle: 'Nothing to hand off',
    icon: Forward,
    color: 'var(--q3)',
    soft: 'var(--q3-soft)',
    tagClass: 'tag-q3'
  },
  {
    key: 'ELIMINATE',
    n: 4,
    code: 'Q4',
    name: 'Eliminate',
    verb: 'Let go',
    urgency: 'Not urgent',
    importance: 'Not important',
    tagline: 'Neither urgent nor important',
    description: 'Busywork and distractions. Decline, batch, or drop them entirely.',
    emptyTitle: 'Nothing to prune',
    icon: Wind,
    color: 'var(--q4)',
    soft: 'var(--q4-soft)',
    tagClass: 'tag-q4'
  }
];

export const QUADRANT_BY_KEY: Record<EisenhowerQuadrant, QuadrantMeta> = Object.fromEntries(
  QUADRANTS.map((q) => [q.key, q])
) as Record<EisenhowerQuadrant, QuadrantMeta>;

export function quadrantOf(q: EisenhowerQuadrant | undefined | null): QuadrantMeta | null {
  return q ? QUADRANT_BY_KEY[q] ?? null : null;
}
