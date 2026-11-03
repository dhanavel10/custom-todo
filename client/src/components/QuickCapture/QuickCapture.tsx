import { useState, useEffect, useRef } from 'react';
import { Plus, ArrowRight, Sparkles, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/date';
import type { Capture, Task } from '../../types';

interface QuickCaptureProps {
  onCaptureSaved: (capture: Capture) => void;
  onTaskCreated?: (task: Task) => void;
}

export const QuickCapture = ({ onCaptureSaved, onTaskCreated }: QuickCaptureProps) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<(Capture & { createdTask?: Task }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    const textToSubmit = text.trim();

    try {
      // 1. Immediately save capture and auto-classify to Eisenhower Matrix with AI
      const result = await api.captures.create(textToSubmit, 'TEXT', true);
      setText('');
      setLastSaved(result);
      onCaptureSaved(result);

      if (result.createdTask && onTaskCreated) {
        onTaskCreated(result.createdTask);
      }

      // Auto-hide feedback after 6 seconds
      setTimeout(() => {
        setLastSaved((prev) => (prev?.id === result.id ? null : prev));
      }, 6000);
    } catch (err: any) {
      setError(err.message || 'Failed to capture item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickConvert = async (capture: Capture) => {
    try {
      const task = await api.captures.convertToTask(capture.id, {
        title: capture.suggestedTitle || capture.rawText,
        dueAt: capture.suggestedDueAt || undefined
      });
      if (onTaskCreated) onTaskCreated(task);
      setLastSaved(null);
    } catch (err: any) {
      setError(err.message || 'Failed to convert to task');
    }
  };

  const getQuadrantBadge = (q?: string) => {
    switch (q) {
      case 'DO_FIRST':
        return <span className="badge badge-urgent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} /> Q1: Do First (Urgent & Important)</span>;
      case 'SCHEDULE':
        return <span className="badge badge-high" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} /> Q2: Schedule (Important)</span>;
      case 'DELEGATE':
        return <span className="badge badge-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} /> Q3: Delegate (Urgent)</span>;
      case 'ELIMINATE':
        return <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} /> Q4: Eliminate</span>;
      default:
        return null;
    }
  };

  return (
    <div className="capture-box">
      <form onSubmit={handleSubmit} className="capture-input-row">
        <Plus size={18} className="text-secondary" />
        <input
          ref={inputRef}
          type="text"
          className="capture-input"
          placeholder="Capture a task... (e.g. 'Complete deployment today', 'Finish report by Friday') [Ctrl+K]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="capture-actions">
          <span className="shortcut-hint">Enter ↵</span>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!text.trim() || isSubmitting}
            title="Save and analyze task"
          >
            {isSubmitting ? 'Analyzing...' : <ArrowRight size={14} />}
          </button>
        </div>
      </form>

      {error && (
        <div className="capture-meta-pill" style={{ color: 'var(--danger)', marginTop: 8 }}>
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {lastSaved && (
        <div className="capture-meta-pill" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Check size={13} style={{ color: 'var(--success)' }} />
            {lastSaved.createdTask ? (
              <>
                <span style={{ fontWeight: 500 }}>Added to Matrix:</span>
                {getQuadrantBadge(lastSaved.createdTask.eisenhowerQuadrant)}
                {lastSaved.createdTask.category && (
                  <span className="badge">{lastSaved.createdTask.category}</span>
                )}
                {lastSaved.createdTask.dueAt && (
                  <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    📅 {formatDate(lastSaved.createdTask.dueAt)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span>Captured to Inbox!</span>
                {lastSaved.suggestedDueAt && (
                  <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> {formatDate(lastSaved.suggestedDueAt)}
                  </span>
                )}
              </>
            )}
          </div>

          {!lastSaved.createdTask && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: 11 }}
              onClick={() => handleQuickConvert(lastSaved)}
            >
              Add as Task Now →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
