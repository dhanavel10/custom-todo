import { useCallback, useEffect, useRef, useState } from 'react';
import { Pin, Archive, ArchiveRestore, Trash2, ArrowLeft, ListTodo, Bold, Italic, Heading2, List, ListChecks, Code, Quote, Link2, Eye, PenLine, Check, CloudOff, type LucideIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { formatRelativeDate } from '../../lib/date';
import { renderMarkdown } from '../../lib/markdown';
import type { Note, Task } from '../../types';
import { Button, IconButton, Segmented, Spinner, useToast } from '../ui';
import './Notes.css';

interface NoteEditorProps {
  note: Note | null;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onConvertToTask: (task: Task) => void;
  onClose: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface FormatAction {
  icon: LucideIcon;
  label: string;
  keys?: string;
  apply: (sel: string) => { text: string; select?: [number, number] };
  line?: boolean;
}

const FORMATS: FormatAction[] = [
  { icon: Bold, label: 'Bold', keys: 'Ctrl+B', apply: (s) => ({ text: `**${s || 'bold'}**`, select: [2, 2 + (s || 'bold').length] }) },
  { icon: Italic, label: 'Italic', keys: 'Ctrl+I', apply: (s) => ({ text: `*${s || 'italic'}*`, select: [1, 1 + (s || 'italic').length] }) },
  { icon: Heading2, label: 'Heading', line: true, apply: (s) => ({ text: `## ${s}` }) },
  { icon: List, label: 'Bullet list', line: true, apply: (s) => ({ text: `- ${s}` }) },
  { icon: ListChecks, label: 'Checklist', line: true, apply: (s) => ({ text: `- [ ] ${s}` }) },
  { icon: Quote, label: 'Quote', line: true, apply: (s) => ({ text: `> ${s}` }) },
  { icon: Code, label: 'Code', apply: (s) => ({ text: s.includes('\n') ? `\`\`\`\n${s}\n\`\`\`` : `\`${s || 'code'}\``, select: s.includes('\n') ? undefined : [1, 1 + (s || 'code').length] }) },
  { icon: Link2, label: 'Link', apply: (s) => ({ text: `[${s || 'text'}](https://)`, select: [(s || 'text').length + 3, (s || 'text').length + 11] }) }
];

export const NoteEditor = ({ note, onUpdateNote, onDeleteNote, onConvertToTask, onClose }: NoteEditorProps) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: '', content: '' });
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title || '');
    setContent(note.content || '');
    latest.current = { title: note.title || '', content: note.content || '' };
    setSaveStatus('saved');
    setSavedAt(note.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  const save = useCallback(async () => {
    if (!note) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaveStatus('saving');
    try {
      const updated = await api.notes.update(note.id, { title: latest.current.title || null, content: latest.current.content });
      onUpdateNote(updated);
      setSavedAt(updated.updatedAt);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [note, onUpdateNote]);

  const schedule = (next: { title?: string; content?: string }) => {
    latest.current = { ...latest.current, ...next };
    setSaveStatus('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save(), 800);
  };

  // Never lose a pending edit when leaving the editor
  const closeEditor = async () => {
    if (debounceRef.current) await save();
    onClose();
  };

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        void save();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const applyFormat = (f: FormatAction) => {
    const el = areaRef.current;
    if (!el) return;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (f.line) {
      start = content.lastIndexOf('\n', start - 1) + 1;
      const nl = content.indexOf('\n', end);
      end = nl === -1 ? content.length : nl;
    }
    const sel = content.slice(start, end);
    const out = f.line ? { text: sel.split('\n').map((l) => f.apply(l).text).join('\n') } : f.apply(sel);
    const next = content.slice(0, start) + out.text + content.slice(end);
    setContent(next);
    schedule({ content: next });
    requestAnimationFrame(() => {
      el.focus();
      if (out.select) el.setSelectionRange(start + out.select[0], start + out.select[1]);
      else el.setSelectionRange(start + out.text.length, start + out.text.length);
    });
  };

  const onAreaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormat(FORMATS[0]);
    } else if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormat(FORMATS[1]);
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Continue lists on Enter
      const el = e.currentTarget;
      const lineStart = content.lastIndexOf('\n', el.selectionStart - 1) + 1;
      const line = content.slice(lineStart, el.selectionStart);
      const m = /^(\s*)(- \[[ xX]\] |[-*+] |(\d+)[.)] )(.*)$/.exec(line);
      if (!m) return;
      e.preventDefault();
      if (!m[4].trim()) {
        // empty item ends the list
        const next = content.slice(0, lineStart) + content.slice(el.selectionStart);
        setContent(next);
        schedule({ content: next });
        requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        return;
      }
      const bullet = m[3] ? `${Number(m[3]) + 1}. ` : m[2].startsWith('- [') ? '- [ ] ' : m[2];
      const insert = `\n${m[1]}${bullet}`;
      const pos = el.selectionStart;
      const next = content.slice(0, pos) + insert + content.slice(el.selectionEnd);
      setContent(next);
      schedule({ content: next });
      requestAnimationFrame(() => el.setSelectionRange(pos + insert.length, pos + insert.length));
    }
  };

  if (!note) return null;

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.round(words / 220));

  const togglePin = async () => {
    try {
      onUpdateNote(await api.notes.pin(note.id));
    } catch {
      toast({ kind: 'error', title: 'Could not update pin' });
    }
  };

  const toggleArchive = async () => {
    try {
      if (debounceRef.current) await save();
      const updated = await api.notes.archive(note.id);
      onUpdateNote(updated);
      toast({ kind: 'info', title: updated.isArchived ? 'Note archived' : 'Note restored', description: updated.isArchived ? 'Find it under Archived in the Idea Pad.' : undefined });
      if (updated.isArchived) onClose();
    } catch {
      toast({ kind: 'error', title: 'Could not archive note' });
    }
  };

  const convert = async () => {
    setConverting(true);
    try {
      if (debounceRef.current) await save();
      const result = await api.notes.convertToTask(note.id, { title: title || (content ? content.slice(0, 80) : 'Note task') });
      onConvertToTask(result.task);
      toast({ title: 'Task created from note', description: 'The note stays in your Idea Pad.' });
    } catch {
      toast({ kind: 'error', title: 'Failed to convert note to task' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="note-editor view-enter">
      <div className="note-bar">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={closeEditor}>
          <span className="hide-sm">Idea Pad</span>
        </Button>
        <span className={`save-state ${saveStatus}`} aria-live="polite">
          {saveStatus === 'saving' && <Spinner size={12} />}
          {saveStatus === 'saved' && <Check />}
          {saveStatus === 'error' && <CloudOff />}
          {saveStatus === 'unsaved' && <i className="save-dot" />}
          <span>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Editing' : saveStatus === 'error' ? 'Not saved' : `Saved ${savedAt ? formatRelativeDate(savedAt) : ''}`}
          </span>
          {saveStatus === 'error' && (
            <button className="save-retry" onClick={() => void save()}>
              Retry
            </button>
          )}
        </span>
        <span className="note-bar-spacer" />
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          items={[
            { value: 'write', label: 'Write', icon: PenLine },
            { value: 'preview', label: 'Preview', icon: Eye }
          ]}
        />
        <div className="note-bar-actions">
          <IconButton icon={Pin} label={note.isPinned ? 'Unpin' : 'Pin to top'} active={note.isPinned} onClick={togglePin} />
          <IconButton icon={note.isArchived ? ArchiveRestore : Archive} label={note.isArchived ? 'Restore from archive' : 'Archive'} onClick={toggleArchive} />
          <IconButton icon={Trash2} label="Delete note" tone="danger" onClick={() => onDeleteNote(note.id)} />
        </div>
        <Button size="sm" variant="soft" icon={ListTodo} loading={converting} onClick={convert}>
          <span className="hide-sm">Make task</span>
        </Button>
      </div>

      <div className="note-scroll">
        <article className="note-paper">
          <input
            className="note-title-input"
            placeholder="Untitled"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              schedule({ title: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setMode('write');
                requestAnimationFrame(() => areaRef.current?.focus());
              }
            }}
            aria-label="Note title"
          />
          <div className="note-meta">
            <span>{words} {words === 1 ? 'word' : 'words'}</span>
            <span>·</span>
            <span>{readMin} min read</span>
            <span>·</span>
            <span>Created {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {note.isPinned && (
              <span className="tag tag-primary tag-sm">
                <Pin />
                <span>Pinned</span>
              </span>
            )}
          </div>

          {mode === 'write' ? (
            <>
              <div className="md-toolbar" role="toolbar" aria-label="Formatting">
                {FORMATS.map((f) => (
                  <IconButton key={f.label} icon={f.icon} label={f.keys ? `${f.label} (${f.keys})` : f.label} size="sm" tipPos="top" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(f)} />
                ))}
              </div>
              <textarea
                ref={areaRef}
                className="note-area"
                placeholder={'Start writing…\n\nMarkdown works: # heading, **bold**, - lists, - [ ] checklists.'}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  schedule({ content: e.target.value });
                }}
                onKeyDown={onAreaKey}
                autoFocus={!note.content}
                aria-label="Note content"
              />
            </>
          ) : (
            <div className="md-preview">{content.trim() ? renderMarkdown(content) : <p className="muted">Nothing to preview yet.</p>}</div>
          )}
        </article>
      </div>
    </div>
  );
};
