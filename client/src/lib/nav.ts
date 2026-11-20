import { LayoutGrid, CalendarDays, Sun, Inbox, CalendarClock, ListTodo, Lightbulb, AlarmClock, GraduationCap, type LucideIcon } from 'lucide-react';

export type ViewMode = 'matrix' | 'planner' | 'today' | 'inbox' | 'upcoming' | 'all' | 'notes' | 'overdue' | 'plans';

export interface NavItem {
  view: ViewMode;
  label: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  shortcut: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Focus',
    items: [
      { view: 'matrix', label: 'Eisenhower Matrix', title: 'Eisenhower Matrix', subtitle: 'Prioritize by urgency and importance', icon: LayoutGrid, shortcut: '1' },
      { view: 'planner', label: 'Day Planner', title: 'Day Planner', subtitle: 'Shape your day on a timeline', icon: CalendarDays, shortcut: '2' },
      { view: 'today', label: 'Today', title: 'Today', subtitle: 'What deserves your attention now', icon: Sun, shortcut: '3' }
    ]
  },
  {
    label: 'Tasks',
    items: [
      { view: 'inbox', label: 'Inbox', title: 'Inbox', subtitle: 'Raw captures waiting to be organized', icon: Inbox, shortcut: '4' },
      { view: 'upcoming', label: 'Upcoming', title: 'Upcoming', subtitle: 'Everything ahead, by date', icon: CalendarClock, shortcut: '5' },
      { view: 'all', label: 'All Tasks', title: 'All Tasks', subtitle: 'Every task, filtered your way', icon: ListTodo, shortcut: '6' },
      { view: 'overdue', label: 'Overdue', title: 'Overdue', subtitle: 'Deadlines that slipped past', icon: AlarmClock, shortcut: '7' }
    ]
  },
  {
    label: 'Create & learn',
    items: [
      { view: 'notes', label: 'Idea Pad', title: 'Idea Pad', subtitle: 'A quiet notebook for your thinking', icon: Lightbulb, shortcut: '8' },
      { view: 'plans', label: 'Study Plans', title: 'Study Plans', subtitle: 'Learn something, one day at a time', icon: GraduationCap, shortcut: '9' }
    ]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
export const NAV_BY_VIEW = Object.fromEntries(NAV_ITEMS.map((n) => [n.view, n])) as Record<ViewMode, NavItem>;
