export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const timeStr = formatTime(date);
  const diffDays = dayDiff(date, now);

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Tomorrow at ${timeStr}`;
  if (diffDays === -1) return `Yesterday at ${timeStr}`;

  return (
    date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }) + ` at ${timeStr}`
  );
}

/** Compact due label used on chips: "Today 6:00 PM", "Tomorrow", "Fri 9:00 AM", "Mar 4". */
export function formatDueShort(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = dayDiff(date, now);
  const time = formatTime(date);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  if (diff > 1 && diff < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHours = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSec) < 60) return 'just now';
  if (diffMin > 0 && diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 0 && diffMin > -60) return `${Math.abs(diffMin)}m ago`;
  if (diffHours > 0 && diffHours < 24) return `in ${diffHours}h`;
  if (diffHours < 0 && diffHours > -24) return `${Math.abs(diffHours)}h ago`;
  if (diffDays > 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

/** "2d 4h", "5h 10m", "12m" — how long ago a deadline passed. */
export function formatOverdueBy(isoString: string | null | undefined, now = Date.now()): string {
  if (!isoString) return '';
  const ms = now - new Date(isoString).getTime();
  if (ms <= 0) return '';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return m > 0 ? `${hours}h ${m}m` : `${hours}h`;
  return `${Math.max(1, m)}m`;
}

export function isOverdue(isoString: string | null | undefined): boolean {
  if (!isoString) return false;
  const date = new Date(isoString);
  return date.getTime() < Date.now();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Calendar-day difference a - b (local time). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayDiff(a, b) === 0;
}

/** Local YYYY-MM-DD key. */
export function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string, hours = 0, minutes = 0): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

/** Local "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Monday-based start of week. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

export function dayLabel(d: Date, now = new Date()): string {
  const diff = dayDiff(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
