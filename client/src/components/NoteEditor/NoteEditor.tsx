import { useState, useEffect, useRef } from 'react';
import { Pin, Archive, Trash2, CheckCircle2, RefreshCw, AlertCircle, ArrowUpRight, Eye, Edit2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Note, Task } from '../../types';

interface NoteEditorProps {
  note: Note | null;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onConvertToTask: (task: Task) => void;
  onClose: () => void;
}

export const NoteEditor = ({
  note,
  onUpdateNote,
  onDeleteNote,
  onConvertToTask,
  onClose
}: NoteEditorProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [previewMode, setPreviewMode] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setSaveStatus('saved');
    }
  }, [note?.id]);

  const saveContent = async (newTitle: string, newContent: string) => {
    if (!note) return;
    setSaveStatus('saving');
    try {
      const updated = await api.notes.update(note.id, {
        title: newTitle || null,
        content: newContent
      });
      onUpdateNote(updated);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSaveStatus('unsaved');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveContent(val, content);
    }, 800);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    setSaveStatus('unsaved');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveContent(title, val);
    }, 800);
  };

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      const updated = await api.notes.pin(note.id);
      onUpdateNote(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleArchive = async () => {
    if (!note) return;
    try {
      const updated = await api.notes.archive(note.id);
      onUpdateNote(updated);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertToTask = async () => {
    if (!note) return;
    try {
      const result = await api.notes.convertToTask(note.id, {
        title: title || (content ? content.slice(0, 80) : 'Note task')
      });
      onConvertToTask(result.task);
      alert('Task created from note! The original note remains safely preserved in your Idea Pad.');
    } catch (err) {
      alert('Failed to convert note to task');
    }
  };

  if (!note) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header / Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveStatus === 'saved' && (
            <span className="badge" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="badge" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={12} className="spin" /> Saving...
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="badge" style={{ color: 'var(--warning)' }}>
              Unsaved changes
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="badge badge-urgent" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> Save failed
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPreviewMode(!previewMode)}
            title="Toggle Markdown Preview"
          >
            {previewMode ? <Edit2 size={13} /> : <Eye size={13} />}
            <span>{previewMode ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            className={`btn btn-ghost btn-sm ${note.isPinned ? 'active' : ''}`}
            onClick={handleTogglePin}
            title={note.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin size={13} fill={note.isPinned ? 'currentColor' : 'none'} />
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleConvertToTask}
            title="Convert note into task without deleting note"
          >
            <ArrowUpRight size={13} />
            <span>Turn into Task</span>
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleToggleArchive}
            title="Archive note"
          >
            <Archive size={13} />
          </button>

          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)' }}
            onClick={() => onDeleteNote(note.id)}
            title="Delete note"
          >
            <Trash2 size={13} />
          </button>

          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <input
          type="text"
          placeholder="Note title (optional)..."
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          style={{
            fontSize: 22,
            fontWeight: 600,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            marginBottom: 16
          }}
        />

        {previewMode ? (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 0',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)'
            }}
          >
            {content || <span style={{ color: 'var(--text-muted)' }}>No content entered.</span>}
          </div>
        ) : (
          <textarea
            placeholder="Type your thoughts, ideas, markdown or notes freely. Everything is autosaved automatically..."
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 15,
              lineHeight: 1.6
            }}
            autoFocus
          />
        )}
      </div>
    </div>
  );
};
