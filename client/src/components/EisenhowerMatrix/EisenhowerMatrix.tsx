import { useState, useEffect } from 'react';
import {
  Check,
  Calendar,
  Sparkles,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Maximize2,
  X,
  Search
} from 'lucide-react';
import { formatDate, isOverdue } from '../../lib/date';
import type { Task, EisenhowerQuadrant, AIStatus } from '../../types';
import './EisenhowerMatrix.css';

interface QuadrantMeta {
  key: EisenhowerQuadrant;
  number: number;
  name: string;
  tagline: string;
  urgencyLabel: string;
  importanceLabel: string;
  description: string;
  accentClass: string;
}

const QUADRANTS: QuadrantMeta[] = [
  {
    key: 'DO_FIRST',
    number: 1,
    name: 'Do First',
    tagline: 'Urgent & Important · Immediate focus and crisis resolution',
    urgencyLabel: 'Urgent',
    importanceLabel: 'Important',
    description: 'High urgency and critical importance. Tasks with imminent deadlines and major impact.',
    accentClass: 'quadrant-do-first'
  },
  {
    key: 'SCHEDULE',
    number: 2,
    name: 'Schedule',
    tagline: 'Important & Not Urgent · Strategic planning and high value',
    urgencyLabel: 'Not Urgent',
    importanceLabel: 'Important',
    description: 'High value long-term goals, strategic thinking, deep work, learning, and health planning.',
    accentClass: 'quadrant-schedule'
  },
  {
    key: 'DELEGATE',
    number: 3,
    name: 'Delegate',
    tagline: 'Urgent & Not Important · Interruptions and routine chores',
    urgencyLabel: 'Urgent',
    importanceLabel: 'Not Important',
    description: 'Time-sensitive requests, routine admin chores, or interruptions that do not need your primary expertise.',
    accentClass: 'quadrant-delegate'
  },
  {
    key: 'ELIMINATE',
    number: 4,
    name: 'Eliminate',
    tagline: 'Not Urgent & Not Important · Distractions and low yield',
    urgencyLabel: 'Not Urgent',
    importanceLabel: 'Not Important',
    description: 'Trivial leisure, busywork, distractions, or low-yield activities to decline or prune.',
    accentClass: 'quadrant-eliminate'
  }
];

interface EisenhowerMatrixProps {
  tasks: Task[];
  aiStatus: AIStatus | null;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onMoveQuadrant: (taskId: string, quadrant: EisenhowerQuadrant) => Promise<void>;
  onReanalyzeTask: (taskId: string) => Promise<void>;
  onQuickAdd: (quadrant?: EisenhowerQuadrant) => void;
  onInlineCreateTask?: (title: string, quadrant: EisenhowerQuadrant) => Promise<any>;
}

export const EisenhowerMatrix = ({
  tasks,
  aiStatus,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onMoveQuadrant,
  onReanalyzeTask,
  onQuickAdd,
  onInlineCreateTask
}: EisenhowerMatrixProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Popup Modal state for focused quadrant view
  const [modalQuadrant, setModalQuadrant] = useState<EisenhowerQuadrant | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [inlineTitle, setInlineTitle] = useState<string>('');
  const [isInlineSaving, setIsInlineSaving] = useState<boolean>(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTooltipId) {
          setActiveTooltipId(null);
        } else if (modalQuadrant) {
          setModalQuadrant(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalQuadrant, activeTooltipId]);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (t.status === 'ARCHIVED') return false;
    if (!showCompleted && t.status === 'COMPLETED') return false;
    if (activeCategory !== 'ALL' && (t.category || 'General') !== activeCategory) return false;
    return true;
  });

  // Extract unique categories
  const categories = Array.from(new Set(tasks.map((t) => t.category || 'General'))).filter(Boolean);

  // Helper to get tasks for a quadrant
  const getTasksForQuadrant = (quadrant: EisenhowerQuadrant) => {
    return filteredTasks.filter((t) => (t.eisenhowerQuadrant || 'DO_FIRST') === quadrant);
  };

  const handleReanalyze = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setReanalyzingId(taskId);
      await onReanalyzeTask(taskId);
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleInlineAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTitle.trim() || !modalQuadrant) return;
    setIsInlineSaving(true);
    try {
      if (onInlineCreateTask) {
        await onInlineCreateTask(inlineTitle.trim(), modalQuadrant);
        setInlineTitle('');
      } else {
        onQuickAdd(modalQuadrant);
      }
    } finally {
      setIsInlineSaving(false);
    }
  };

  const renderTaskCard = (task: Task) => {
    const isCompleted = task.status === 'COMPLETED';
    const overdue = !isCompleted && isOverdue(task.dueAt);
    const isBusy = reanalyzingId === task.id;

    return (
      <div
        key={task.id}
        className={`matrix-card ${isCompleted ? 'completed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="matrix-card-top">
          <div
            className={`checkbox-custom ${isCompleted ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task);
            }}
            role="checkbox"
            aria-checked={isCompleted}
            tabIndex={0}
            title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
          >
            {isCompleted && <Check size={12} strokeWidth={3} />}
          </div>

          <div
            className={`matrix-card-title ${isCompleted ? 'completed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onEditTask(task);
            }}
            style={{ cursor: 'pointer' }}
          >
            {task.title}
          </div>
        </div>

        {task.description && (
          <div
            className="matrix-card-desc"
            onClick={(e) => {
              e.stopPropagation();
              onEditTask(task);
            }}
            style={{ cursor: 'pointer' }}
          >
            {task.description}
          </div>
        )}

        <div className="matrix-card-meta">
          {task.category && (
            <span className="meta-pill category" title="AI Categorization">
              {task.category}
            </span>
          )}

          {task.dueAt && (
            <span
              className={`meta-pill ${task.isDeadline ? 'deadline' : ''} ${overdue ? 'overdue' : ''}`}
              title={task.isDeadline ? 'Hard deadline identified' : 'Date mentioned in context'}
            >
              <Calendar size={10} />
              {formatDate(task.dueAt)}
              {task.isDeadline && ' (Deadline)'}
              {overdue && ' (Overdue)'}
            </span>
          )}

          {task.aiAnalysis && (
            <span
              className="meta-pill ai-insight"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltipId(activeTooltipId === task.id ? null : task.id);
              }}
              title="Click to view AI reasoning"
            >
              <Sparkles size={10} />
              {task.aiAnalysis.source === 'ollama' ? 'Ollama AI' : 'NLP'}
              {task.urgency === 'URGENT' ? ' · Urgent' : ''}
            </span>
          )}
        </div>

        {/* AI Insight Reason Popover */}
        {activeTooltipId === task.id && task.aiAnalysis && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              AI Analysis ({task.aiAnalysis.model}):
            </div>
            <div>{task.aiAnalysis.reasoning}</div>
            <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Urgency: {task.aiAnalysis.urgencyScore}/10 · Importance: {task.aiAnalysis.importanceScore}/10
            </div>
          </div>
        )}

        <div className="matrix-card-footer">
          <select
            className="quadrant-select"
            value={task.eisenhowerQuadrant || 'DO_FIRST'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onMoveQuadrant(task.id, e.target.value as EisenhowerQuadrant)}
            title="Move to quadrant"
          >
            <option value="DO_FIRST">Q1: Do First</option>
            <option value="SCHEDULE">Q2: Schedule</option>
            <option value="DELEGATE">Q3: Delegate</option>
            <option value="ELIMINATE">Q4: Eliminate</option>
          </select>

          <div className="matrix-card-actions">
            <button
              className="btn btn-ghost btn-icon"
              title="Re-analyze with Ollama AI"
              disabled={isBusy}
              onClick={(e) => handleReanalyze(task.id, e)}
            >
              <RefreshCw size={12} className={isBusy ? 'spin' : ''} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              title="Edit Task"
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
            >
              <Edit3 size={12} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              title="Delete Task"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Find active modal quadrant config and tasks
  const activeQuadMeta = QUADRANTS.find((q) => q.key === modalQuadrant);
  const activeModalTasks = modalQuadrant
    ? getTasksForQuadrant(modalQuadrant).filter((t) => {
        if (!modalSearch.trim()) return true;
        const q = modalSearch.toLowerCase();
        return t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false);
      })
    : [];

  return (
    <div className="matrix-container">
      {/* Header & Controls */}
      <div className="matrix-header">
        <div className="matrix-title-group">
          <h1 className="matrix-title">Eisenhower Matrix</h1>
          <span className="matrix-subtitle">
            Click any matrix to open in a focused modal view
          </span>
        </div>

        <div className="matrix-toolbar">
          {/* Ollama Model Status Badge */}
          <div
            className="ai-status-pill"
            title={aiStatus?.connected ? `Connected to Ollama (${aiStatus.model})` : (aiStatus?.error || 'Ollama offline, fallback active')}
          >
            <span className={`ai-status-dot ${aiStatus?.connected ? '' : 'offline'}`} />
            <span>
              {aiStatus?.connected ? `Ollama: ${aiStatus.model}` : 'NLP Fallback'}
            </span>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              className="select"
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Completed Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Completed
          </label>
        </div>
      </div>

      {/* 2x2 Quadrant Grid */}
      <div className="matrix-grid">
        {QUADRANTS.map((quad) => {
          const quadTasks = getTasksForQuadrant(quad.key);
          return (
            <div
              key={quad.key}
              className={`matrix-quadrant ${quad.accentClass}`}
              onClick={(e) => {
                // If user clicked inside a card or button, ignore
                if ((e.target as HTMLElement).closest('.matrix-card, button, select, input')) return;
                setModalQuadrant(quad.key);
                setModalSearch('');
              }}
              title="Click to view this matrix in popup modal"
            >
              <div
                className="quadrant-header"
                onClick={() => {
                  setModalQuadrant(quad.key);
                  setModalSearch('');
                }}
              >
                <div className="quadrant-info">
                  <div className="quadrant-title-row">
                    <span className="quadrant-name">{quad.number}. {quad.name}</span>
                    <span className="quadrant-badge">{quadTasks.length}</span>
                  </div>
                  <span className="quadrant-tagline">{quad.tagline}</span>
                </div>
                <div className="quadrant-header-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-icon"
                    title={`Open ${quad.name} in popup modal`}
                    onClick={() => {
                      setModalQuadrant(quad.key);
                      setModalSearch('');
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title={`Add task to ${quad.name}`}
                    onClick={() => onQuickAdd(quad.key)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="quadrant-content">
                {quadTasks.length === 0 ? (
                  <div
                    className="quadrant-empty"
                    onClick={() => {
                      setModalQuadrant(quad.key);
                      setModalSearch('');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>No {quad.name.toLowerCase()} tasks</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Click to open matrix modal</span>
                  </div>
                ) : (
                  quadTasks.map(renderTaskCard)
                )}
                <button
                  className="quadrant-add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(quad.key);
                  }}
                >
                  <Plus size={13} /> Add to {quad.name}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* POPUP MODAL FOR CLICKED MATRIX */}
      {modalQuadrant && activeQuadMeta && (
        <div
          className="modal-overlay"
          onClick={() => setModalQuadrant(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content matrix-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="matrix-modal-header">
              <div className="matrix-modal-header-left">
                <div className="matrix-modal-title-row">
                  <span className="matrix-modal-title">
                    {activeQuadMeta.number}. {activeQuadMeta.name}
                  </span>
                  <span className="quadrant-badge">
                    {getTasksForQuadrant(activeQuadMeta.key).length} Tasks
                  </span>
                </div>
                <p className="matrix-modal-subtitle">
                  {activeQuadMeta.tagline}
                </p>
              </div>

              <div className="matrix-modal-header-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onQuickAdd(activeQuadMeta.key)}
                >
                  <Plus size={13} /> Add Task
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setModalQuadrant(null)}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Switcher Tabs between the 4 Matrices */}
            <div className="matrix-modal-tabs">
              {QUADRANTS.map((q) => {
                const count = getTasksForQuadrant(q.key).length;
                const isActive = modalQuadrant === q.key;
                return (
                  <button
                    key={q.key}
                    type="button"
                    className={`matrix-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setModalQuadrant(q.key);
                      setModalSearch('');
                      setInlineTitle('');
                    }}
                  >
                    <span>{q.number}. {q.name}</span>
                    <span className="matrix-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Filter inside Modal */}
            <div className="matrix-modal-search-row">
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input"
                  placeholder={`Filter tasks in ${activeQuadMeta.name}...`}
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32 }}
                />
              </div>
            </div>

            {/* Modal Body - Tasks List */}
            <div className="matrix-modal-body">
              {activeModalTasks.length === 0 ? (
                <div className="quadrant-empty" style={{ padding: '40px 16px' }}>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {modalSearch ? 'No matching tasks' : `No tasks in ${activeQuadMeta.name}`}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 16px' }}>
                    {activeQuadMeta.description}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onQuickAdd(activeQuadMeta.key)}
                  >
                    <Plus size={13} /> Add First Task
                  </button>
                </div>
              ) : (
                activeModalTasks.map(renderTaskCard)
              )}
            </div>

            {/* Modal Footer - Inline Quick Capture */}
            <div className="matrix-modal-footer">
              <form onSubmit={handleInlineAddSubmit} style={{ display: 'flex', width: '100%', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder={`Quick add task to ${activeQuadMeta.name}... (Press Enter)`}
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  disabled={isInlineSaving}
                  style={{ fontSize: '0.82rem', height: 34 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!inlineTitle.trim() || isInlineSaving}
                >
                  {isInlineSaving ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
