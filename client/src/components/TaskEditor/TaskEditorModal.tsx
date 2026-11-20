import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Hash, Sparkles, Wand2, X, CircleDot, Flag, SquarePen, Plus } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus, EisenhowerQuadrant } from '../../types';
import { QUADRANTS } from '../../lib/quadrants';
import { addDays, startOfDay, toLocalInput } from '../../lib/date';
import { Button, Dialog, Kbd, Segmented, isMac } from '../ui';
import './TaskEditor.css';

interface TaskEditorModalProps {
  task: Partial<Task> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => Promise<void>;
  onReanalyze?: (taskId: string) => Promise<void>;
  categories?: string[];
}

const PRIORITIES: { value: Exclude<TaskPriority, null> | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' }
];

const at = (d: Date, h: number) => {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return toLocalInput(x);
};

export const TaskEditorModal = ({ task, isOpen, onClose, onSave, onReanalyze, categories = [] }: TaskEditorModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>(null);
  const [category, setCategory] = useState('');
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant | 'AUTO'>('AUTO');
  const [dueAt, setDueAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = Boolean(task && task.id);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setStatus(task?.status || 'TODO');
    setPriority(task?.priority || null);
    setCategory(task?.category || '');
    setQuadrant(task?.eisenhowerQuadrant || 'AUTO');
    setDueAt(task?.dueAt ? toLocalInput(new Date(task.dueAt)) : '');
    setTimeout(() => {
      const el = titleRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 40);
  }, [task, isOpen]);

  // Grow the title field with its content
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title, isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority: priority || null,
        category: category.trim() || undefined,
        eisenhowerQuadrant: quadrant === 'AUTO' ? undefined : quadrant,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null
      });
    } finally {
      setIsSaving(false);
    }
  };

  const reanalyze = async () => {
    if (!task?.id || !onReanalyze || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await onReanalyze(task.id);
      onClose();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const today = startOfDay(new Date());
  const dueChips = [
    { label: 'Today', value: at(today, 18) },
    { label: 'Tomorrow', value: at(addDays(today, 1), 9) },
    { label: 'Next week', value: at(addDays(today, ((8 - today.getDay()) % 7) || 7), 9) }
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      width={640}
      icon={isEditing ? SquarePen : Plus}
      title={isEditing ? 'Edit task' : 'New task'}
      subtitle={isEditing ? undefined : 'Leave the quadrant on Auto and AI will place it for you.'}
      footer={
        <>
          {isEditing && onReanalyze && (
            <Button variant="ghost" size="sm" icon={Wand2} onClick={reanalyze} loading={isAnalyzing}>
              Re-analyze
            </Button>
          )}
          <span className="spacer" />
          <span className="t-meta hide-sm" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>↵</Kbd>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-editor-form" loading={isSaving} disabled={!title.trim()}>
            {isEditing ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form
        id="task-editor-form"
        onSubmit={handleSubmit}
        className="task-editor"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      >
        <textarea
          ref={titleRef}
          className="te-title"
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) e.preventDefault();
          }}
          placeholder="What needs to be done?"
          aria-label="Task title"
          required
        />
        <textarea className="te-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add notes, context, or a date mentioned in passing…" rows={3} aria-label="Description" />

        <div className="te-section">
          <div className="te-label">
            <Sparkles /> Quadrant
          </div>
          <div className="te-quadrants">
            <button type="button" className={`te-q auto ${quadrant === 'AUTO' ? 'is-active' : ''}`} onClick={() => setQuadrant('AUTO')}>
              <Sparkles />
              <span>
                <b>Auto</b>
                <em>AI decides</em>
              </span>
            </button>
            <div className="te-q-grid">
              {QUADRANTS.map((q) => {
                const Icon = q.icon;
                return (
                  <button type="button" key={q.key} className={`te-q ${quadrant === q.key ? 'is-active' : ''}`} style={{ ['--q' as string]: q.color }} onClick={() => setQuadrant(q.key)} aria-pressed={quadrant === q.key}>
                    <Icon />
                    <span>
                      <b>{q.name}</b>
                      <em>{q.tagline}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="te-grid">
          <div className="field">
            <label className="field-label" htmlFor="te-due">
              <CalendarClock /> Due
            </label>
            <div className="te-due">
              <input id="te-due" type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              {dueAt && <Button size="sm" variant="ghost" icon={X} aria-label="Clear due date" onClick={() => setDueAt('')} />}
            </div>
            <div className="te-chips">
              {dueChips.map((c) => (
                <button type="button" key={c.label} className={`chip ${dueAt === c.value ? 'is-active' : ''}`} onClick={() => setDueAt(c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="te-cat">
              <Hash /> Category
            </label>
            <input id="te-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Auto-detected if empty" list="te-categories" />
            <datalist id="te-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="te-grid">
          <div className="field">
            <span className="field-label">
              <CircleDot /> Status
            </span>
            <Segmented
              size="sm"
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              items={[
                ...(task?.status === 'INBOX' ? [{ value: 'INBOX' as TaskStatus, label: 'Inbox' }] : []),
                { value: 'TODO', label: 'To do' },
                { value: 'IN_PROGRESS', label: 'Doing' },
                { value: 'COMPLETED', label: 'Done' },
                { value: 'ARCHIVED', label: 'Archived' }
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">
              <Flag /> Priority
            </span>
            <Segmented size="sm" value={priority ?? 'NONE'} onChange={(v) => setPriority(v === 'NONE' ? null : (v as TaskPriority))} items={PRIORITIES} />
          </div>
        </div>

        {isEditing && task?.aiAnalysis && (
          <div className="ai-why te-ai">
            <div className="ai-why-head">
              <Sparkles /> {task.aiAnalysis.source === 'ollama' ? 'AI analysis' : 'NLP analysis'} · {task.aiAnalysis.model}
              <span className="ai-why-scores">
                U {task.aiAnalysis.urgencyScore}/10 · I {task.aiAnalysis.importanceScore}/10
              </span>
            </div>
            <p>{task.aiAnalysis.reasoning}</p>
          </div>
        )}
      </form>
    </Dialog>
  );
};
