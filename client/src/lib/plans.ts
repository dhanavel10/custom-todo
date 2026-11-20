import type { NewPlanItem, Plan, PlanItem, PlanSummary } from '../types';

/** Turn pasted lines into per-day items. Accepts "Day 3: Topic", "1. Topic", "- Topic" or just "Topic". */
export function parseConcepts(text: string, startDate: string, time: string, perDay: number, duration: number): NewPlanItem[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*(day\s*\d+\s*[:.\-–]\s*|\d+[.)]\s*|[-*]\s*)/i, '').trim())
    .filter(Boolean);
  const [y, m, d] = startDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);

  return lines.map((title, idx) => {
    const dayIdx = Math.floor(idx / perDay);
    const slot = idx % perDay;
    // local time; later slots on the same day follow one after another
    const when = new Date(y, m - 1, d + dayIdx, hh, mm + slot * duration, 0, 0);
    return { title, dayNumber: dayIdx + 1, scheduledAt: when.toISOString(), durationMinutes: duration };
  });
}

export type PlanStatus = 'done' | 'behind' | 'active' | 'upcoming';

export function planStatus(p: PlanSummary): { key: PlanStatus; label: string; tone: string; tag: string } {
  if (p.totalItems > 0 && p.completedItems === p.totalItems) return { key: 'done', label: 'Completed', tone: 'var(--green)', tag: 'tag-green' };
  if (p.missedItems > 0) return { key: 'behind', label: 'Needs attention', tone: 'var(--coral)', tag: 'tag-coral' };
  if (p.completedItems > 0) return { key: 'active', label: 'On track', tone: 'var(--primary)', tag: 'tag-primary' };
  return { key: 'upcoming', label: 'Not started', tone: 'var(--teal)', tag: 'tag-teal' };
}

/** The first pending item, in schedule order. */
export function nextItem(plan: Plan): PlanItem | null {
  return [...plan.items].filter((i) => i.status === 'PENDING').sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0] ?? null;
}
