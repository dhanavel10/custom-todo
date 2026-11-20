import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, getAuthToken, setAuthToken, isTokenExpired } from './lib/api';
import { NAV_BY_VIEW, type ViewMode } from './lib/nav';
import { Sidebar } from './components/Shell/Sidebar';
import { Topbar } from './components/Shell/Topbar';
import { CommandPalette } from './components/QuickCapture/CommandPalette';
import { DayPlanner } from './components/DayPlanner/DayPlanner';
import { TaskEditorModal } from './components/TaskEditor/TaskEditorModal';
import { EisenhowerMatrix } from './components/EisenhowerMatrix/EisenhowerMatrix';
import { NoteEditor } from './components/NoteEditor/NoteEditor';
import { ReminderPickerModal } from './components/ReminderPicker/ReminderPickerModal';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { PlansView } from './components/Plans/PlansView';
import { PlanDetail } from './components/Plans/PlanDetail';
import { RescheduleModal } from './components/Plans/RescheduleModal';
import { SettingsModal, type ThemePref } from './components/Settings/SettingsModal';
import { AuthModal } from './components/Auth/AuthModal';
import { TaskListSkeleton, useConfirm, useToast } from './components/ui';
import { TodayView } from './views/TodayView';
import { InboxView } from './views/InboxView';
import { UpcomingView } from './views/UpcomingView';
import { AllTasksView } from './views/AllTasksView';
import { OverdueView } from './views/OverdueView';
import { NotesView } from './views/NotesView';
import type { TaskActions } from './views/types';
import { isSameDay } from './lib/date';
import type { Task, Capture, Note, Notification, User as UserType, UserPreferences, EisenhowerQuadrant, AIStatus, Plan, PlanSummary, MissedPlanItem, PlanItem, NewPlanItem, PreferencesUpdate } from './types';

const VIEW_KEY = 'pi.view';
const SIDEBAR_KEY = 'pi.sidebarCollapsed';

const readStorage = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeStorage = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function App() {
  const toast = useToast();
  const confirm = useConfirm();

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    const v = readStorage(VIEW_KEY) as ViewMode | null;
    return v && v in NAV_BY_VIEW ? v : 'matrix';
  });
  const [themePref, setThemePref] = useState<ThemePref>(() => (readStorage('theme') as ThemePref | null) || 'light');
  const [systemIsDark, setSystemIsDark] = useState(systemDark);
  const theme: 'light' | 'dark' = themePref === 'system' ? (systemIsDark ? 'dark' : 'light') : themePref;

  // Entities
  const [tasks, setTasks] = useState<Task[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [missedItems, setMissedItems] = useState<MissedPlanItem[]>([]);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<Plan | null>(null);
  const [rescheduleItems, setRescheduleItems] = useState<MissedPlanItem[] | null>(null);
  const [dismissedMissed, setDismissedMissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<Partial<Task> | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [reminderTask, setReminderTask] = useState<Task | null>(null);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStorage(SIDEBAR_KEY) === '1');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastUnread = useRef<number | null>(null);

  /* ---------------- Theme ---------------- */
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', theme);
    const t = setTimeout(() => root.classList.remove('theme-transition'), 320);
    return () => clearTimeout(t);
  }, [theme]);

  const chooseTheme = (t: ThemePref) => {
    setThemePref(t);
    writeStorage('theme', t);
  };
  const toggleTheme = () => chooseTheme(theme === 'light' ? 'dark' : 'light');

  /* ---------------- Navigation ---------------- */
  const navigate = useCallback((v: ViewMode) => {
    setCurrentView(v);
    writeStorage(VIEW_KEY, v);
    setMobileNavOpen(false);
    setActiveNote(null);
    if (v === 'plans') {
      setOpenPlanId(null);
      setOpenPlan(null);
    }
  }, []);

  const toggleSidebar = () =>
    setSidebarCollapsed((c) => {
      writeStorage(SIDEBAR_KEY, c ? '0' : '1');
      return !c;
    });

  // Global shortcuts: Ctrl/Cmd+K → command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- Auth & data ---------------- */
  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      setAuthToken(null);
      setCurrentUser(null);
      setPreferences(null);
      setTasks([]);
      setCaptures([]);
      setNotes([]);
      setNotifications([]);
      setPlans([]);
      setLoaded(true);
      setIsAuthOpen(true);
      const customMsg = (e as CustomEvent)?.detail?.message || 'Your 7-day session has expired. Please sign in again.';
      toast({ kind: 'info', title: 'Session Expired', description: customMsg });
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [toast]);

  const bootstrapAuth = async () => {
    try {
      const token = getAuthToken();
      if (!token || isTokenExpired(token)) {
        setAuthToken(null);
        setCurrentUser(null);
        setLoaded(true);
        setIsAuthOpen(true);
        return;
      }
      const me = await api.auth.me();
      setCurrentUser(me.user);
      setPreferences(me.preferences);
      await loadAllData();
    } catch (err) {
      console.warn('Session expired or authentication required:', err);
      setAuthToken(null);
      setCurrentUser(null);
      setLoaded(true);
      setIsAuthOpen(true);
    }
  };

  const loadAllData = async () => {
    try {
      const [tList, cList, nList, notifRes, ai, planList] = await Promise.all([
        api.tasks.list(),
        api.captures.list(),
        api.notes.list(),
        api.notifications.list(),
        api.tasks.getAIStatus().catch(() => null),
        api.plans.list().catch(() => [] as PlanSummary[])
      ]);
      setPlans(planList);
      api.plans.missed().then(setMissedItems).catch(() => {});
      setTasks(tList);
      setCaptures(cList);
      setNotes(nList);
      setNotifications(notifRes.notifications);
      setUnreadNotifCount(notifRes.unreadCount);
      lastUnread.current = notifRes.unreadCount;
      if (ai) setAiStatus(ai);
    } catch (err) {
      console.error('Failed loading data:', err);
      toast({ kind: 'error', title: "Couldn't load your data", description: 'Check that the server is running, then refresh.' });
    } finally {
      setLoaded(true);
    }
  };

  // Periodic notifications check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!currentUser) return;
      try {
        const res = await api.notifications.list();
        setNotifications(res.notifications);
        setUnreadNotifCount(res.unreadCount);
        // Surface brand-new reminders as a toast
        if (lastUnread.current !== null && res.unreadCount > lastUnread.current) {
          const newest = res.notifications.find((n) => !n.readAt);
          if (newest) toast({ kind: 'reminder', title: newest.title, description: newest.body, action: { label: 'View', onClick: () => setIsNotifDrawerOpen(true) } });
        }
        lastUnread.current = res.unreadCount;
        await refreshPlans();
      } catch {
        /* offline — try again next tick */
      }
    }, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, openPlanId]);

  /* ---------------- Study plans ---------------- */
  const planTitles = Object.fromEntries(plans.map((p) => [p.id, p.title]));

  const refreshPlans = async () => {
    const [list, missed] = await Promise.all([api.plans.list(), api.plans.missed()]);
    setPlans(list);
    setMissedItems(missed);
    if (openPlanId) api.plans.get(openPlanId).then(setOpenPlan).catch(() => {});
  };

  const handleOpenPlan = async (id: string) => {
    setOpenPlanId(id);
    setOpenPlan(null);
    try {
      setOpenPlan(await api.plans.get(id));
    } catch (err) {
      console.error('Failed to load plan:', err);
      toast({ kind: 'error', title: 'Could not open that plan' });
      setOpenPlanId(null);
    }
  };

  // Automatically ask for a new time whenever there are missed items we haven't prompted for yet
  useEffect(() => {
    if (rescheduleItems) return;
    const fresh = missedItems.filter((i) => !dismissedMissed.has(i.id));
    if (fresh.length > 0) setRescheduleItems(fresh);
  }, [missedItems, rescheduleItems, dismissedMissed]);

  const handleCreatePlan = async (body: { title: string; description?: string; items: NewPlanItem[] }) => {
    await api.plans.create(body);
    await refreshPlans();
    toast({ title: 'Study plan created', description: `${body.items.length} concepts scheduled.` });
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await api.plans.delete(id);
      await refreshPlans();
      setRescheduleItems((prev) => {
        const rest = prev ? prev.filter((i) => i.planId !== id) : [];
        return rest.length ? rest : null;
      });
      toast({ kind: 'info', title: 'Plan deleted' });
    } catch {
      toast({ kind: 'error', title: 'Could not delete plan' });
    }
  };

  const handleTogglePlanItem = async (item: PlanItem) => {
    try {
      await api.plans.toggleItem(item.id);
      await refreshPlans();
    } catch (err) {
      console.error('Failed to update plan item:', err);
      toast({ kind: 'error', title: 'Could not update that session' });
    }
  };

  const handleReschedulePlanItem = async (itemId: string, scheduledAtIso: string) => {
    await api.plans.rescheduleItem(itemId, scheduledAtIso);
    await refreshPlans();
    setRescheduleItems((prev) => {
      const rest = prev ? prev.filter((i) => i.id !== itemId) : [];
      return rest.length ? rest : null;
    });
    toast({ title: 'Session rescheduled', description: new Date(scheduledAtIso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) });
  };

  const closeRescheduleModal = () => {
    setDismissedMissed((prev) => {
      const next = new Set(prev);
      (rescheduleItems || []).forEach((i) => next.add(i.id));
      return next;
    });
    setRescheduleItems(null);
  };

  /* ---------------- Tasks ---------------- */
  const replaceTask = (updated: Task) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const handleToggleComplete = async (task: Task) => {
    // Optimistic: flip status immediately, reconcile with server response
    const optimistic: Task = { ...task, status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED' };
    replaceTask(optimistic);
    try {
      replaceTask(await api.tasks.complete(task.id));
    } catch (err) {
      console.error('Failed to complete task:', err);
      replaceTask(task);
      toast({ kind: 'error', title: 'Could not update task' });
    }
  };

  const handleSaveTaskUpdates = async (updates: Partial<Task>) => {
    try {
      if (modalTask && modalTask.id) {
        replaceTask(await api.tasks.update(modalTask.id, updates));
        toast({ title: 'Task updated' });
      } else {
        const created = await api.tasks.create(updates);
        setTasks((prev) => [created, ...prev]);
        toast({ title: 'Task created', description: created.title });
      }
      setIsTaskModalOpen(false);
      setModalTask(null);
    } catch (err) {
      console.error('Failed to save task:', err);
      toast({ kind: 'error', title: 'Failed to save task', description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleMoveQuadrant = async (taskId: string, quadrant: EisenhowerQuadrant) => {
    const before = tasks.find((t) => t.id === taskId);
    if (before) replaceTask({ ...before, eisenhowerQuadrant: quadrant });
    try {
      replaceTask(await api.tasks.moveToQuadrant(taskId, quadrant));
    } catch (err) {
      console.error('Failed to move quadrant:', err);
      if (before) replaceTask(before);
      toast({ kind: 'error', title: 'Could not move task' });
    }
  };

  const handleReanalyzeTask = async (taskId: string) => {
    try {
      const updated = await api.tasks.reanalyze(taskId);
      replaceTask(updated);
      toast({ kind: 'info', title: 'Re-analyzed', description: updated.aiAnalysis?.reasoning?.slice(0, 120) });
    } catch {
      toast({ kind: 'error', title: 'Failed to re-analyze task', description: 'The AI service may be offline.' });
    }
  };

  const handleQuickAdd = (quadrant?: EisenhowerQuadrant) => {
    setModalTask({ title: '', description: '', eisenhowerQuadrant: quadrant || undefined, status: 'TODO' });
    setIsTaskModalOpen(true);
  };

  const handleInlineCreateTask = async (title: string, quadrant: EisenhowerQuadrant) => {
    try {
      const created = await api.tasks.create({ title, eisenhowerQuadrant: quadrant, status: 'TODO' });
      setTasks((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to quick add task to matrix:', err);
      toast({ kind: 'error', title: 'Could not add task' });
    }
  };

  const handleOpenEdit = (task: Task) => {
    setModalTask(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const ok = await confirm({ title: 'Delete this task?', message: task ? `“${task.title}” will be permanently removed.` : undefined, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.tasks.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast({ kind: 'info', title: 'Task deleted' });
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast({ kind: 'error', title: 'Could not delete task' });
    }
  };

  const handleSnooze = async (task: Task) => {
    try {
      const current = task.dueAt ? new Date(task.dueAt) : new Date();
      current.setDate(current.getDate() + 1);
      replaceTask(await api.tasks.update(task.id, { dueAt: current.toISOString() }));
      toast({ kind: 'info', title: 'Snoozed until tomorrow' });
    } catch (err) {
      console.error('Failed to snooze task:', err);
      toast({ kind: 'error', title: 'Could not snooze task' });
    }
  };

  const handleSetReminder = async (taskId: string, remindAtIso: string) => {
    try {
      await api.tasks.addReminder(taskId, remindAtIso);
      toast({ kind: 'reminder', title: 'Reminder scheduled', description: new Date(remindAtIso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
    } catch {
      toast({ kind: 'error', title: 'Failed to set reminder' });
    }
  };

  const handleUpdateTaskDate = async (taskId: string, dateIso: string | null) => {
    const before = tasks.find((t) => t.id === taskId);
    if (before) replaceTask({ ...before, dueAt: dateIso });
    try {
      replaceTask(await api.tasks.update(taskId, { dueAt: dateIso }));
    } catch (err) {
      console.error('Failed to update task date:', err);
      if (before) replaceTask(before);
      toast({ kind: 'error', title: 'Could not reschedule task' });
    }
  };

  const handleRescheduleTask = (taskId: string, iso: string | null) => {
    void handleUpdateTaskDate(taskId, iso).then(() =>
      toast({ kind: 'info', title: iso ? 'Rescheduled' : 'Date removed', description: iso ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined })
    );
  };

  const handleQuickCreateTaskForDay = async (title: string, dateIso: string) => {
    try {
      const created = await api.tasks.create({ title, dueAt: dateIso, status: 'TODO' });
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      console.error('Failed to create task for day:', err);
      toast({ kind: 'error', title: 'Could not create task' });
    }
  };

  /* ---------------- Captures ---------------- */
  const handleCaptureSaved = useCallback((capture: Capture) => setCaptures((prev) => [capture, ...prev]), []);
  const handleTaskCreated = useCallback((task: Task) => setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]), []);
  const handleCaptureConverted = useCallback((id: string) => setCaptures((prev) => prev.filter((c) => c.id !== id)), []);

  const handleConvertCaptureToTask = async (capture: Capture) => {
    try {
      const task = await api.captures.convertToTask(capture.id, { title: capture.suggestedTitle || capture.rawText, dueAt: capture.suggestedDueAt || undefined });
      setTasks((prev) => [task, ...prev]);
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
      toast({ title: 'Converted to task', description: task.title, action: { label: 'Open', onClick: () => handleOpenEdit(task) } });
    } catch {
      toast({ kind: 'error', title: 'Failed to convert to task' });
    }
  };

  const handleConvertCaptureToNote = async (capture: Capture) => {
    try {
      const note = await api.captures.convertToNote(capture.id, { title: capture.suggestedTitle || null, content: capture.rawText });
      setNotes((prev) => [note, ...prev]);
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
      toast({ title: 'Saved as a note', action: { label: 'Open', onClick: () => { navigate('notes'); setActiveNote(note); } } });
    } catch {
      toast({ kind: 'error', title: 'Failed to convert to note' });
    }
  };

  const handleDeleteCapture = async (id: string) => {
    try {
      await api.captures.delete(id);
      setCaptures((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete capture:', err);
      toast({ kind: 'error', title: 'Could not delete capture' });
    }
  };

  /* ---------------- Notes ---------------- */
  const handleCreateNewNote = async () => {
    try {
      const newNote = await api.notes.create({ title: '', content: '' });
      setNotes((prev) => [newNote, ...prev]);
      navigate('notes');
      setActiveNote(newNote);
    } catch {
      toast({ kind: 'error', title: 'Failed to create note' });
    }
  };

  // Upsert so restoring an archived note brings it back into the list
  const handleUpdateNote = useCallback((updated: Note) => {
    setNotes((prev) => (prev.some((n) => n.id === updated.id) ? prev.map((n) => (n.id === updated.id ? updated : n)) : [updated, ...prev]));
    setActiveNote((cur) => (cur?.id === updated.id ? updated : cur));
  }, []);

  const handleDeleteNote = async (id: string) => {
    const ok = await confirm({ title: 'Delete this note?', message: 'This cannot be undone. Archive it instead if you might need it later.', confirmLabel: 'Delete note', danger: true });
    if (!ok) return;
    try {
      await api.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNote?.id === id) setActiveNote(null);
      toast({ kind: 'info', title: 'Note deleted' });
    } catch (err) {
      console.error('Failed to delete note:', err);
      toast({ kind: 'error', title: 'Could not delete note' });
    }
  };

  /* ---------------- Derived ---------------- */
  const searchedTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false) || (t.category?.toLowerCase().includes(q) ?? false));
  }, [tasks, searchQuery]);

  const counts = useMemo(() => {
    const now = new Date();
    const open = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED' && t.dueAt);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    return {
      today: open.filter((t) => isSameDay(new Date(t.dueAt!), now)).length,
      overdue: open.filter((t) => new Date(t.dueAt!).getTime() < now.getTime()).length,
      upcoming: open.filter((t) => new Date(t.dueAt!).getTime() > endToday.getTime()).length,
      inbox: captures.length,
      notes: notes.filter((n) => !n.isArchived).length,
      missed: missedItems.length
    };
    // re-evaluate as notifications poll ticks so "overdue" stays fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, captures, notes, missedItems, notifications]);

  const categories = useMemo(() => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean) as string[])).sort(), [tasks]);

  const actions: TaskActions = {
    onToggleComplete: handleToggleComplete,
    onEdit: handleOpenEdit,
    onDelete: handleDeleteTask,
    onAddReminder: setReminderTask,
    onSnooze: handleSnooze,
    onReschedule: handleRescheduleTask
  };

  const nav = NAV_BY_VIEW[currentView];
  const pageTitle = currentView === 'plans' && openPlanId ? openPlan?.title || 'Study plan' : nav.title;
  const showSearch = currentView !== 'plans' && !(currentView === 'notes' && activeNote);
  const layout = currentView === 'matrix' || (currentView === 'notes' && activeNote) ? 'full' : currentView === 'planner' ? 'wide' : '';
  const searchPlaceholder = currentView === 'notes' ? 'Search notes' : currentView === 'inbox' ? 'Search inbox' : 'Search tasks';

  const renderView = () => {
    if (!loaded && ['today', 'upcoming', 'all', 'overdue', 'inbox'].includes(currentView)) return <TaskListSkeleton rows={6} />;
    switch (currentView) {
      case 'matrix':
        return (
          <EisenhowerMatrix
            tasks={searchedTasks}
            aiStatus={aiStatus}
            onToggleComplete={handleToggleComplete}
            onEditTask={handleOpenEdit}
            onDeleteTask={handleDeleteTask}
            onMoveQuadrant={handleMoveQuadrant}
            onReanalyzeTask={handleReanalyzeTask}
            onQuickAdd={handleQuickAdd}
            onInlineCreateTask={handleInlineCreateTask}
          />
        );
      case 'planner':
        return (
          <DayPlanner
            tasks={searchedTasks}
            onToggleComplete={handleToggleComplete}
            onEditTask={handleOpenEdit}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskDate={handleUpdateTaskDate}
            onQuickCreateTask={handleQuickCreateTaskForDay}
          />
        );
      case 'today':
        return (
          <TodayView
            tasks={searchedTasks}
            user={currentUser}
            overdueCount={counts.overdue}
            onGoOverdue={() => navigate('overdue')}
            onQuickCreate={handleQuickCreateTaskForDay}
            onCaptureSaved={handleCaptureSaved}
            onTaskCreated={handleTaskCreated}
            onCaptureConverted={handleCaptureConverted}
            {...actions}
          />
        );
      case 'inbox':
        return (
          <InboxView
            captures={captures}
            searchQuery={searchQuery}
            onConvertToTask={handleConvertCaptureToTask}
            onConvertToNote={handleConvertCaptureToNote}
            onDelete={handleDeleteCapture}
            onCaptureSaved={handleCaptureSaved}
            onTaskCreated={handleTaskCreated}
            onCaptureConverted={handleCaptureConverted}
          />
        );
      case 'upcoming':
        return <UpcomingView tasks={searchedTasks} searchQuery={searchQuery} {...actions} />;
      case 'all':
        return <AllTasksView tasks={searchedTasks} searchQuery={searchQuery} statusFilter={statusFilter} onStatusFilter={setStatusFilter} {...actions} />;
      case 'overdue':
        return <OverdueView tasks={searchedTasks} searchQuery={searchQuery} {...actions} />;
      case 'notes':
        return activeNote ? (
          <NoteEditor note={activeNote} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote} onConvertToTask={(t) => setTasks((prev) => [t, ...prev])} onClose={() => setActiveNote(null)} />
        ) : (
          <NotesView notes={notes} searchQuery={searchQuery} onOpen={setActiveNote} onCreate={handleCreateNewNote} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote} />
        );
      case 'plans':
        return openPlanId ? (
          <PlanDetail
            plan={openPlan}
            onBack={() => {
              setOpenPlanId(null);
              setOpenPlan(null);
            }}
            onToggleItem={handleTogglePlanItem}
            onRescheduleClick={(item) => setRescheduleItems([{ ...item, planTitle: openPlan?.title || '' }])}
          />
        ) : (
          <PlansView plans={plans} onCreate={handleCreatePlan} onDelete={handleDeletePlan} onOpen={handleOpenPlan} />
        );
    }
  };

  return (
    <div className="app">
      <Sidebar
        current={currentView}
        onNavigate={navigate}
        counts={counts}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        user={currentUser}
        aiStatus={aiStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignIn={() => setIsAuthOpen(true)}
        onSignOut={async () => {
          const ok = await confirm({ title: 'Sign out?', message: 'You can sign back in any time.', confirmLabel: 'Sign out' });
          if (!ok) return;
          api.auth.logout().catch(() => {});
          setAuthToken(null);
          setCurrentUser(null);
          setIsAuthOpen(true);
        }}
      />

      <main className="main">
        <Topbar
          title={pageTitle}
          subtitle={currentView === 'plans' && openPlanId ? 'Study plan' : nav.subtitle}
          icon={nav.icon}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          searchPlaceholder={searchPlaceholder}
          showSearch={showSearch}
          onAddTask={() => handleQuickAdd()}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenNotifications={() => setIsNotifDrawerOpen(true)}
          unreadCount={unreadNotifCount}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <div className="content">
          <div className={`content-inner ${layout}`} key={`${currentView}-${openPlanId ?? ''}-${activeNote ? 'editor' : ''}`}>
            {renderView()}
          </div>
        </div>

        <button className="fab" onClick={() => setPaletteOpen(true)} aria-label="Quick capture">
          <Sparkles />
        </button>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCaptureSaved={handleCaptureSaved}
        onTaskCreated={handleTaskCreated}
        onCaptureConverted={handleCaptureConverted}
        onNavigate={navigate}
        onNewTask={() => handleQuickAdd()}
        onNewNote={handleCreateNewNote}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <TaskEditorModal
        task={modalTask}
        isOpen={isTaskModalOpen}
        categories={categories}
        onClose={() => {
          setIsTaskModalOpen(false);
          setModalTask(null);
        }}
        onSave={handleSaveTaskUpdates}
        onReanalyze={handleReanalyzeTask}
      />

      <ReminderPickerModal task={reminderTask} isOpen={Boolean(reminderTask)} onClose={() => setReminderTask(null)} onSetReminder={handleSetReminder} />

      {rescheduleItems && rescheduleItems.length > 0 && <RescheduleModal items={rescheduleItems} planTitles={planTitles} onReschedule={handleReschedulePlanItem} onClose={closeRescheduleModal} />}

      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        notifications={notifications}
        onMarkRead={async (id) => {
          await api.notifications.markRead(id);
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
          setUnreadNotifCount((prev) => Math.max(0, prev - 1));
          lastUnread.current = Math.max(0, (lastUnread.current ?? 1) - 1);
        }}
        onMarkAllRead={async () => {
          await api.notifications.markAllRead();
          setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
          setUnreadNotifCount(0);
          lastUnread.current = 0;
        }}
      />

      <SettingsModal
        user={currentUser}
        preferences={preferences}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateUser={async (userData: Partial<UserType>) => {
          const res = await api.user.updateMe(userData);
          setCurrentUser(res.user);
        }}
        onUpdatePreferences={async (prefs: PreferencesUpdate) => {
          const res = await api.user.updatePreferences(prefs);
          setPreferences(res);
          toast({ title: 'Settings saved' });
        }}
        themePref={themePref}
        onThemePref={chooseTheme}
      />

      <AuthModal
        isOpen={isAuthOpen}
        canDismiss={!!currentUser}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u, p) => {
          setCurrentUser(u);
          setPreferences(p);
          setLoaded(false);
          loadAllData();
        }}
      />
    </div>
  );
}

export default App;
