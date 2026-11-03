import { useState, useEffect } from 'react';
import { X, Calendar, AlignLeft, Sparkles, Tag, Layers } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus, EisenhowerQuadrant } from '../../types';

interface TaskEditorModalProps {
  task: Partial<Task> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => Promise<void>;
  onReanalyze?: (taskId: string) => Promise<void>;
}

export const TaskEditorModal = ({
  task,
  isOpen,
  onClose,
  onSave,
  onReanalyze
}: TaskEditorModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>(null);
  const [category, setCategory] = useState('');
  const [eisenhowerQuadrant, setEisenhowerQuadrant] = useState<EisenhowerQuadrant | 'AUTO'>('AUTO');
  const [dueAt, setDueAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isEditing = Boolean(task && task.id);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'TODO');
      setPriority(task.priority || null);
      setCategory(task.category || '');
      setEisenhowerQuadrant(task.eisenhowerQuadrant || 'AUTO');
      if (task.dueAt) {
        const d = new Date(task.dueAt);
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDueAt(formatted);
      } else {
        setDueAt('');
      }
    } else {
      setTitle('');
      setDescription('');
      setStatus('TODO');
      setPriority(null);
      setCategory('');
      setEisenhowerQuadrant('AUTO');
      setDueAt('');
    }
  }, [task]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const dueIso = dueAt ? new Date(dueAt).toISOString() : null;
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority: priority || null,
        category: category.trim() || undefined,
        eisenhowerQuadrant: eisenhowerQuadrant === 'AUTO' ? undefined : eisenhowerQuadrant,
        dueAt: dueIso
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerReanalyze = async () => {
    if (!task?.id || !onReanalyze || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await onReanalyze(task.id);
      onClose();
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">
            {isEditing ? 'Edit Task' : 'Add New Task'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* AI Helper Banner */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
            <span>
              Ollama AI extracts dates, verifies deadlines, detects urgency, and organizes your task into the Eisenhower Matrix.
            </span>
          </div>

          <div className="input-group">
            <label className="label">Task Title / Action</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare presentation slides for Q4 roadmap"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlignLeft size={13} /> Description & Context
            </label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, notes, or dates mentioned in context (e.g. 'Must submit by next Friday for review')..."
              rows={3}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} /> Deadline / Due Date
              </label>
              <input
                type="datetime-local"
                className="input"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={13} /> Category
              </label>
              <input
                type="text"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Auto-detected by AI if empty"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} /> Eisenhower Quadrant
              </label>
              <select
                className="select"
                value={eisenhowerQuadrant}
                onChange={(e) => setEisenhowerQuadrant(e.target.value as EisenhowerQuadrant | 'AUTO')}
              >
                <option value="AUTO">✨ AI Auto-Classify (Based on Input)</option>
                <option value="DO_FIRST">Q1: Do First (Urgent & Important)</option>
                <option value="SCHEDULE">Q2: Schedule (Important, Not Urgent)</option>
                <option value="DELEGATE">Q3: Delegate (Urgent, Not Important)</option>
                <option value="ELIMINATE">Q4: Eliminate (Not Urgent, Not Important)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="label">Status</label>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="INBOX">Inbox</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            {isEditing && onReanalyze && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleTriggerReanalyze}
                disabled={isAnalyzing}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={13} />
                {isAnalyzing ? 'Analyzing...' : 'Re-analyze with Ollama'}
              </button>
            )}

            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
