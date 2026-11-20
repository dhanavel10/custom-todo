import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CornerDownLeft, Sparkles, SquarePen, Moon, Settings, Lightbulb, Check, Inbox, AlertCircle, type LucideIcon } from 'lucide-react';
import type { Capture, Task } from '../../types';
import { NAV_ITEMS, type ViewMode } from '../../lib/nav';
import { formatDueShort } from '../../lib/date';
import { Kbd, Spinner, QuadrantTag, CategoryTag, Button, useExitTransition, useLayer } from '../ui';
import { CAPTURE_SUGGESTIONS, useCapture } from './useCapture';
import './CommandPalette.css';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: 'Capture' | 'Jump to' | 'Actions';
  run: () => void;
  keywords?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCaptureSaved: (c: Capture) => void;
  onTaskCreated: (t: Task) => void;
  onCaptureConverted: (captureId: string) => void;
  onNavigate: (v: ViewMode) => void;
  onNewTask: () => void;
  onNewNote: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export const CommandPalette = ({ open, onClose, onCaptureSaved, onTaskCreated, onCaptureConverted, onNavigate, onNewTask, onNewNote, onToggleTheme, onOpenSettings }: Props) => {
  const { mounted, closing } = useExitTransition(open, 160);
  useLayer(open, onClose);
  const [text, setText] = useState('');
  const [sel, setSel] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { submit, convertToTask, submitting, error, result, reset } = useCapture(onCaptureSaved, onTaskCreated, onCaptureConverted);

  useEffect(() => {
    if (!open) return;
    setText('');
    setSel(0);
    reset();
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open, reset]);

  // Rotate placeholder suggestions while empty
  useEffect(() => {
    if (!open || text) return;
    const id = setInterval(() => setHintIdx((i) => (i + 1) % CAPTURE_SUGGESTIONS.length), 3200);
    return () => clearInterval(id);
  }, [open, text]);

  const run = (fn: () => void) => {
    onClose();
    // let the palette start closing before the next surface opens
    setTimeout(fn, 60);
  };

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.view}`,
      label: n.label,
      hint: n.subtitle,
      icon: n.icon,
      group: 'Jump to',
      run: () => run(() => onNavigate(n.view)),
      keywords: `go ${n.view} ${n.title}`
    }));
    const actions: Command[] = [
      { id: 'new-task', label: 'New task with details…', icon: SquarePen, group: 'Actions', run: () => run(onNewTask), keywords: 'add create task' },
      { id: 'new-note', label: 'New note', icon: Lightbulb, group: 'Actions', run: () => run(onNewNote), keywords: 'idea write' },
      { id: 'theme', label: 'Toggle light / dark theme', icon: Moon, group: 'Actions', run: () => run(onToggleTheme), keywords: 'dark light appearance' },
      { id: 'settings', label: 'Open settings', icon: Settings, group: 'Actions', run: () => run(onOpenSettings), keywords: 'preferences profile' }
    ];
    return [...nav, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate, onNewTask, onNewNote, onToggleTheme, onOpenSettings]);

  const q = text.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = q ? commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q)) : commands;
    const captureCmd: Command[] = q
      ? [
          {
            id: 'capture',
            label: text.trim(),
            icon: Sparkles,
            group: 'Capture',
            run: () => {
              void submit(text).then((r) => r && setText(''));
            }
          }
        ]
      : [];
    return [...captureCmd, ...base.slice(0, q ? 5 : base.length)];
  }, [q, text, commands, submit]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[sel]?.run();
    } else if (e.key === 'Tab' && !text) {
      e.preventDefault();
      setText(CAPTURE_SUGGESTIONS[hintIdx]);
    }
  };

  if (!mounted) return null;

  let lastGroup = '';
  return createPortal(
    <div className={`palette-overlay ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick capture and command palette">
        <div className={`palette-input-row ${submitting ? 'is-busy' : ''}`}>
          <span className="palette-glyph">{submitting ? <Spinner size={16} /> : <Sparkles />}</span>
          <div className="palette-input-wrap">
            <input
              ref={inputRef}
              className="palette-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder=""
              aria-label="Capture a task or type a command"
              disabled={submitting}
              spellCheck
            />
            {!text && (
              <span className="palette-placeholder" key={hintIdx} aria-hidden="true">
                {CAPTURE_SUGGESTIONS[hintIdx]}
              </span>
            )}
          </div>
          {!text ? <Kbd>Tab</Kbd> : <Kbd><CornerDownLeft size={11} /></Kbd>}
        </div>
        {submitting && <div className="palette-progress" />}

        {(result || error) && (
          <div className={`palette-result ${error ? 'is-error' : ''}`} role="status">
            {error ? (
              <>
                <AlertCircle className="palette-result-icon" />
                <div className="palette-result-text">
                  <strong>Couldn't capture that</strong>
                  <span>{error}</span>
                </div>
              </>
            ) : result?.createdTask ? (
              <>
                <span className="palette-result-check">
                  <Check strokeWidth={3} />
                </span>
                <div className="palette-result-text">
                  <strong>{result.createdTask.title}</strong>
                  <span className="palette-result-tags">
                    <QuadrantTag quadrant={result.createdTask.eisenhowerQuadrant} size="sm" />
                    <CategoryTag category={result.createdTask.category} size="sm" />
                    {result.createdTask.dueAt && <span className="tag tag-sm">{formatDueShort(result.createdTask.dueAt)}</span>}
                    <span className="muted">· placed in your matrix</span>
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(() => onNavigate('matrix'))} iconRight={ArrowRight}>
                  View
                </Button>
              </>
            ) : result ? (
              <>
                <span className="palette-result-check inbox">
                  <Inbox />
                </span>
                <div className="palette-result-text">
                  <strong>Saved to Inbox</strong>
                  <span>
                    Detected as {result.detectedType.toLowerCase()}
                    {result.suggestedDueAt ? ` · ${formatDueShort(result.suggestedDueAt)}` : ''}
                  </span>
                </div>
                <Button size="sm" variant="soft" onClick={() => convertToTask(result)}>
                  Make it a task
                </Button>
              </>
            ) : null}
          </div>
        )}

        <div className="palette-list" ref={listRef} role="listbox">
          {!q && (
            <div className="palette-tips">
              <span className="t-eyebrow">Write naturally</span>
              <p>
                Dates like <em>“tomorrow 5pm”</em> or <em>“by Friday”</em> are detected, and AI files the task into the right quadrant.
              </p>
            </div>
          )}
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                {showGroup && <div className="palette-group">{c.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={sel === i}
                  data-idx={i}
                  className={`palette-item ${sel === i ? 'is-selected' : ''} ${c.group === 'Capture' ? 'is-capture' : ''}`}
                  onMouseMove={() => sel !== i && setSel(i)}
                  onClick={() => c.run()}
                >
                  <span className="palette-item-icon">
                    <Icon />
                  </span>
                  <span className="palette-item-label">
                    {c.group === 'Capture' ? (
                      <>
                        Capture <span className="palette-quote">“{c.label}”</span>
                      </>
                    ) : (
                      c.label
                    )}
                  </span>
                  {c.group === 'Capture' ? <span className="palette-item-hint">AI classify</span> : c.hint && <span className="palette-item-hint">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="palette-foot">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> select</span>
          <span><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
