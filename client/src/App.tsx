import { useState, useEffect } from 'react';
import {
  Inbox,
  Calendar,
  Clock,
  CheckSquare,
  BookOpen,
  AlertTriangle,
  Bell,
  Settings as SettingsIcon,
  Search,
  Plus,
  Trash2,
  Sparkles,
  FileText,
  User,
  LogOut,
  Moon,
  Sun,
  LayoutGrid,
  CalendarDays
} from 'lucide-react';
import { api, getAuthToken, setAuthToken } from './lib/api';
import { formatDate } from './lib/date';
import { QuickCapture } from './components/QuickCapture/QuickCapture';
import { DayPlanner } from './components/DayPlanner/DayPlanner';
import { TaskItem } from './components/TaskItem/TaskItem';
import { TaskEditorModal } from './components/TaskEditor/TaskEditorModal';
import { EisenhowerMatrix } from './components/EisenhowerMatrix/EisenhowerMatrix';
import { NoteEditor } from './components/NoteEditor/NoteEditor';
import { ReminderPickerModal } from './components/ReminderPicker/ReminderPickerModal';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { SettingsModal } from './components/Settings/SettingsModal';
import { AuthModal } from './components/Auth/AuthModal';
import type { Task, Capture, Note, Notification, User as UserType, UserPreferences, EisenhowerQuadrant, AIStatus } from './types';

type ViewMode = 'matrix' | 'planner' | 'today' | 'inbox' | 'upcoming' | 'all' | 'notes' | 'overdue';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('matrix');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Entities
  const [tasks, setTasks] = useState<Task[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

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

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Check auth & bootstrap
  useEffect(() => {
    bootstrapAuth();
  }, []);

  const bootstrapAuth = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        // Create or login default demo user for effortless zero-friction testing
        try {
          const res = await api.auth.login({ email: 'demo@personal.local', password: 'demo_password_123' });
          setAuthToken(res.token);
          setCurrentUser(res.user);
        } catch {
          const res = await api.auth.register({
            email: 'demo@personal.local',
            password: 'demo_password_123',
            displayName: 'Personal User'
          });
          setAuthToken(res.token);
          setCurrentUser(res.user);
        }
      }

      const me = await api.auth.me();
      setCurrentUser(me.user);
      setPreferences(me.preferences);
      await loadAllData();
    } catch (err) {
      console.error('Failed auth bootstrap:', err);
      setIsAuthOpen(true);
    }
  };

  const loadAllData = async () => {
    try {
      const [tList, cList, nList, notifRes, ai] = await Promise.all([
        api.tasks.list(),
        api.captures.list(),
        api.notes.list(),
        api.notifications.list(),
        api.tasks.getAIStatus().catch(() => null)
      ]);
      setTasks(tList);
      setCaptures(cList);
      setNotes(nList);
      setNotifications(notifRes.notifications);
      setUnreadNotifCount(notifRes.unreadCount);
      if (ai) setAiStatus(ai);
    } catch (err) {
      console.error('Failed loading data:', err);
    }
  };

  // Periodic notifications check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser) {
        try {
          const res = await api.notifications.list();
          setNotifications(res.notifications);
          setUnreadNotifCount(res.unreadCount);
        } catch {}
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Task Actions
  const handleToggleComplete = async (task: Task) => {
    try {
      const updated = await api.tasks.complete(task.id);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleSaveTaskUpdates = async (updates: Partial<Task>) => {
    try {
      if (modalTask && modalTask.id) {
        const updated = await api.tasks.update(modalTask.id, updates);
        setTasks((prev) => prev.map((t) => (t.id === modalTask.id ? updated : t)));
      } else {
        const created = await api.tasks.create(updates);
        setTasks((prev) => [created, ...prev]);
      }
      setIsTaskModalOpen(false);
      setModalTask(null);
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Failed to save task');
    }
  };

  const handleMoveQuadrant = async (taskId: string, quadrant: EisenhowerQuadrant) => {
    try {
      const updated = await api.tasks.moveToQuadrant(taskId, quadrant);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error('Failed to move quadrant:', err);
    }
  };

  const handleReanalyzeTask = async (taskId: string) => {
    try {
      const updated = await api.tasks.reanalyze(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      alert('Failed to re-analyze task');
    }
  };

  const handleQuickAdd = (quadrant?: EisenhowerQuadrant) => {
    setModalTask({
      title: '',
      description: '',
      eisenhowerQuadrant: quadrant || undefined,
      status: 'TODO'
    });
    setIsTaskModalOpen(true);
  };

  const handleInlineCreateTask = async (title: string, quadrant: EisenhowerQuadrant) => {
    try {
      const created = await api.tasks.create({
        title,
        eisenhowerQuadrant: quadrant,
        status: 'TODO'
      });
      setTasks((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to quick add task to matrix:', err);
    }
  };

  const handleOpenEdit = (task: Task) => {
    setModalTask(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.tasks.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleSnooze = async (task: Task) => {
    try {
      const current = task.dueAt ? new Date(task.dueAt) : new Date();
      current.setDate(current.getDate() + 1);
      const updated = await api.tasks.update(task.id, { dueAt: current.toISOString() });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      console.error('Failed to snooze task:', err);
    }
  };

  const handleSetReminder = async (taskId: string, remindAtIso: string) => {
    try {
      await api.tasks.addReminder(taskId, remindAtIso);
      alert('Reminder scheduled!');
    } catch (err) {
      alert('Failed to set reminder');
    }
  };

  const handleUpdateTaskDate = async (taskId: string, dateIso: string | null) => {
    try {
      const updated = await api.tasks.update(taskId, { dueAt: dateIso });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error('Failed to update task date:', err);
    }
  };

  const handleQuickCreateTaskForDay = async (title: string, dateIso: string) => {
    try {
      const created = await api.tasks.create({
        title,
        dueAt: dateIso,
        status: 'TODO'
      });
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      console.error('Failed to create task for day:', err);
    }
  };

  // Capture Actions
  const handleCaptureSaved = (capture: Capture) => {
    setCaptures((prev) => [capture, ...prev]);
  };

  const handleConvertCaptureToTask = async (capture: Capture) => {
    try {
      const task = await api.captures.convertToTask(capture.id, {
        title: capture.suggestedTitle || capture.rawText,
        dueAt: capture.suggestedDueAt || undefined
      });
      setTasks((prev) => [task, ...prev]);
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
    } catch (err) {
      alert('Failed to convert to task');
    }
  };

  const handleConvertCaptureToNote = async (capture: Capture) => {
    try {
      const note = await api.captures.convertToNote(capture.id, {
        title: capture.suggestedTitle || null,
        content: capture.rawText
      });
      setNotes((prev) => [note, ...prev]);
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id));
      setActiveNote(note);
    } catch (err) {
      alert('Failed to convert to note');
    }
  };

  const handleDeleteCapture = async (id: string) => {
    try {
      await api.captures.delete(id);
      setCaptures((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete capture:', err);
    }
  };

  // Note Actions
  const handleCreateNewNote = async () => {
    try {
      const newNote = await api.notes.create({ title: '', content: '' });
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
    } catch (err) {
      alert('Failed to create new note');
    }
  };

  const handleUpdateNote = (updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    if (activeNote?.id === updated.id) {
      setActiveNote(updated);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNote?.id === id) setActiveNote(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Filter tasks based on view and search
  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc) return false;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const dueTime = t.dueAt ? new Date(t.dueAt).getTime() : null;

    if (currentView === 'today') {
      if (t.status === 'ARCHIVED') return false;
      return dueTime !== null && dueTime >= startOfToday && dueTime <= endOfToday;
    }

    if (currentView === 'upcoming') {
      if (t.status === 'ARCHIVED' || t.status === 'COMPLETED') return false;
      return dueTime !== null && dueTime > endOfToday;
    }

    if (currentView === 'overdue') {
      if (t.status === 'ARCHIVED' || t.status === 'COMPLETED') return false;
      return dueTime !== null && dueTime < now.getTime();
    }

    if (currentView === 'all') {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      return true;
    }

    return true;
  });

  // Calculate Badges
  const nowTime = Date.now();
  const todayTasksCount = tasks.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'ARCHIVED') return false;
    if (!t.dueAt) return false;
    const d = new Date(t.dueAt);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;

  const overdueCount = tasks.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'ARCHIVED') return false;
    return t.dueAt ? new Date(t.dueAt).getTime() < nowTime : false;
  }).length;

  const inboxCount = captures.length;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-primary)' }} />
            <span>Productivity Inbox</span>
          </div>
          <span className="sidebar-brand-badge">SQLite</span>
        </div>

        <nav className="nav-group">
          <button
            className={`nav-item ${currentView === 'matrix' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('matrix');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <LayoutGrid size={15} />
              <span>Eisenhower Matrix</span>
            </div>
            <span className="sidebar-brand-badge" style={{ fontSize: 9 }}>AI</span>
          </button>

          <button
            className={`nav-item ${currentView === 'planner' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('planner');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <CalendarDays size={15} />
              <span>Day Planner</span>
            </div>
            <span className="sidebar-brand-badge" style={{ fontSize: 9 }}>Schedule</span>
          </button>

          <button
            className={`nav-item ${currentView === 'today' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('today');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <Calendar size={15} />
              <span>Today</span>
            </div>
            {todayTasksCount > 0 && <span className="nav-badge">{todayTasksCount}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'inbox' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('inbox');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <Inbox size={15} />
              <span>Inbox</span>
            </div>
            {inboxCount > 0 && <span className="nav-badge">{inboxCount}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'upcoming' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('upcoming');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <Clock size={15} />
              <span>Upcoming</span>
            </div>
          </button>

          <button
            className={`nav-item ${currentView === 'all' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('all');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <CheckSquare size={15} />
              <span>All Tasks</span>
            </div>
          </button>

          <button
            className={`nav-item ${currentView === 'notes' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('notes');
            }}
          >
            <div className="nav-item-left">
              <BookOpen size={15} />
              <span>Idea Pad</span>
            </div>
            {notes.length > 0 && <span className="nav-badge">{notes.length}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'overdue' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('overdue');
              setActiveNote(null);
            }}
          >
            <div className="nav-item-left">
              <AlertTriangle size={15} style={{ color: overdueCount > 0 ? 'var(--danger)' : undefined }} />
              <span style={{ color: overdueCount > 0 ? 'var(--danger)' : undefined }}>Overdue</span>
            </div>
            {overdueCount > 0 && <span className="nav-badge danger">{overdueCount}</span>}
          </button>
        </nav>

        {/* Sidebar Footer with User profile */}
        <div className="sidebar-footer">
          {currentUser ? (
            <div className="user-profile-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={14} className="text-secondary" />
                <span className="user-email-text" title={currentUser.email}>
                  {currentUser.displayName || currentUser.email}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                title="Sign Out"
                onClick={() => {
                  api.auth.logout();
                  setAuthToken(null);
                  setCurrentUser(null);
                  setIsAuthOpen(true);
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setIsAuthOpen(true)}>
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-wrapper">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">
              {currentView === 'matrix' && 'Eisenhower Matrix'}
              {currentView === 'planner' && 'Day-by-Day Task Schedule'}
              {currentView === 'today' && 'Today'}
              {currentView === 'inbox' && 'Universal Inbox'}
              {currentView === 'upcoming' && 'Upcoming Tasks'}
              {currentView === 'all' && 'All Tasks'}
              {currentView === 'notes' && 'Idea Pad & Notes'}
              {currentView === 'overdue' && 'Overdue Attention'}
            </h1>
          </div>

          <div className="top-bar-actions">
            {/* Quick Add Task Button */}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleQuickAdd()}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> Add Task
            </button>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 30, height: 34, fontSize: 13 }}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Notifications Bell */}
            <button
              className="btn btn-ghost btn-icon"
              style={{ position: 'relative' }}
              title="Notifications"
              onClick={() => setIsNotifDrawerOpen(true)}
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger)'
                  }}
                />
              )}
            </button>

            {/* Theme Toggle */}
            <button className="btn btn-ghost btn-icon" title="Toggle Light/Dark Theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Settings */}
            <button className="btn btn-ghost btn-icon" title="Settings" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon size={16} />
            </button>
          </div>
        </header>

        {/* Content Scroll View */}
        <div className="content-scroll">
          {/* Universal Quick Capture Bar: always visible on task/inbox views */}
          {currentView !== 'notes' && (
            <QuickCapture
              onCaptureSaved={handleCaptureSaved}
              onTaskCreated={(task) => setTasks((prev) => [task, ...prev])}
            />
          )}

          {/* INBOX VIEW */}
          {currentView === 'inbox' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Unprocessed captures waiting to be organized or converted
                </span>
                <span className="badge">{captures.length} items</span>
              </div>

              {captures.length === 0 ? (
                <div className="empty-state">
                  <Inbox size={28} className="empty-state-icon" />
                  <div className="empty-state-title">Inbox is clear</div>
                  <div className="empty-state-desc">Capture raw thoughts or tasks anytime above!</div>
                </div>
              ) : (
                captures.map((cap) => (
                  <div key={cap.id} className="item-card">
                    <div className="item-content">
                      <div className="item-title">{cap.rawText}</div>
                      <div className="item-meta">
                        <span className="badge">{cap.detectedType}</span>
                        {cap.suggestedDueAt && (
                          <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkles size={11} /> {formatDate(cap.suggestedDueAt)}
                          </span>
                        )}
                        {cap.parseStatus === 'NEEDS_REVIEW' && (
                          <span className="badge badge-high">Needs Date Confirmation</span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}>{formatDate(cap.createdAt)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleConvertCaptureToTask(cap)}
                        title="Convert to Task"
                      >
                        <CheckSquare size={13} /> Task
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleConvertCaptureToNote(cap)}
                        title="Convert to Note"
                      >
                        <FileText size={13} /> Note
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleDeleteCapture(cap.id)}
                        title="Delete"
                      >
                        <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* EISENHOWER MATRIX VIEW */}
          {currentView === 'matrix' && (
            <div style={{ height: 'calc(100vh - 200px)' }}>
              <EisenhowerMatrix
                tasks={tasks}
                aiStatus={aiStatus}
                onToggleComplete={handleToggleComplete}
                onEditTask={handleOpenEdit}
                onDeleteTask={handleDeleteTask}
                onMoveQuadrant={handleMoveQuadrant}
                onReanalyzeTask={handleReanalyzeTask}
                onQuickAdd={handleQuickAdd}
                onInlineCreateTask={handleInlineCreateTask}
              />
            </div>
          )}

          {/* DAY PLANNER & SCHEDULE SPLITTING VIEW */}
          {currentView === 'planner' && (
            <DayPlanner
              tasks={tasks}
              onToggleComplete={handleToggleComplete}
              onEditTask={handleOpenEdit}
              onDeleteTask={handleDeleteTask}
              onUpdateTaskDate={handleUpdateTaskDate}
              onQuickCreateTask={handleQuickCreateTaskForDay}
            />
          )}

          {/* TASK VIEWS: TODAY / UPCOMING / ALL / OVERDUE */}
          {['today', 'upcoming', 'all', 'overdue'].includes(currentView) && (
            <div>
              {/* Filter tabs for ALL TASKS */}
              {currentView === 'all' && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                  {['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].map((st) => (
                    <button
                      key={st}
                      className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}

              {filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <CheckSquare size={28} className="empty-state-icon" />
                  <div className="empty-state-title">No tasks found</div>
                  <div className="empty-state-desc">
                    {currentView === 'today'
                      ? 'You have no tasks scheduled for today. Enjoy your day!'
                      : 'Capture a task above to get started.'}
                  </div>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteTask}
                    onAddReminder={(t) => setReminderTask(t)}
                    onSnooze={handleSnooze}
                  />
                ))
              )}
            </div>
          )}

          {/* IDEA PAD / NOTES VIEW */}
          {currentView === 'notes' && (
            <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
              {activeNote ? (
                <NoteEditor
                  note={activeNote}
                  onUpdateNote={handleUpdateNote}
                  onDeleteNote={handleDeleteNote}
                  onConvertToTask={(t) => setTasks((prev) => [t, ...prev])}
                  onClose={() => setActiveNote(null)}
                />
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Notes & Thoughts</h2>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Distraction-free idea pad with instant autosaving and Markdown support
                      </p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleCreateNewNote}>
                      <Plus size={14} /> New Note
                    </button>
                  </div>

                  {notes.length === 0 ? (
                    <div className="empty-state">
                      <BookOpen size={28} className="empty-state-icon" />
                      <div className="empty-state-title">No notes yet</div>
                      <div className="empty-state-desc">Capture freeform ideas and thoughts without constraints.</div>
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={handleCreateNewNote}>
                        Create first note
                      </button>
                    </div>
                  ) : (
                    <div className="notes-grid">
                      {notes.map((note) => (
                        <div key={note.id} className="note-card" onClick={() => setActiveNote(note)}>
                          <div className="note-title">{note.title || 'Untitled note'}</div>
                          <div className="note-preview">{note.content || 'Blank note...'}</div>
                          <div className="note-footer">
                            <span>{formatDate(note.updatedAt)}</span>
                            {note.isPinned && <span className="badge">Pinned</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Task Creation & Edit Modal */}
      <TaskEditorModal
        task={modalTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setModalTask(null);
        }}
        onSave={handleSaveTaskUpdates}
        onReanalyze={handleReanalyzeTask}
      />

      <ReminderPickerModal
        task={reminderTask}
        isOpen={Boolean(reminderTask)}
        onClose={() => setReminderTask(null)}
        onSetReminder={handleSetReminder}
      />

      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        notifications={notifications}
        onMarkRead={async (id) => {
          await api.notifications.markRead(id);
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
          setUnreadNotifCount((prev) => Math.max(0, prev - 1));
        }}
        onMarkAllRead={async () => {
          await api.notifications.markAllRead();
          setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
          setUnreadNotifCount(0);
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
        onUpdatePreferences={async (prefs: Partial<UserPreferences>) => {
          const res = await api.user.updatePreferences(prefs);
          setPreferences(res);
        }}
        currentTheme={theme}
        onToggleTheme={toggleTheme}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u, p) => {
          setCurrentUser(u);
          setPreferences(p);
          loadAllData();
        }}
      />
    </div>
  );
}

export default App;
