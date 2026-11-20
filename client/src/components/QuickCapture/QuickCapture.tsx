import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp, Check, Inbox, AlertCircle, X } from 'lucide-react';
import type { Capture, Task } from '../../types';
import { formatDueShort } from '../../lib/date';
import { Kbd, Spinner, QuadrantTag, CategoryTag, Button, IconButton } from '../ui';
import { CAPTURE_SUGGESTIONS, useCapture } from './useCapture';
import './CommandPalette.css';

interface QuickCaptureProps {
  onCaptureSaved: (capture: Capture) => void;
  onTaskCreated?: (task: Task) => void;
  onCaptureConverted?: (captureId: string) => void;
  placeholder?: string;
}

/** Inline capture bar shown at the top of Inbox / Today. Ctrl+K opens the full palette. */
export const QuickCapture = ({ onCaptureSaved, onTaskCreated, onCaptureConverted, placeholder }: QuickCaptureProps) => {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [hintIdx, setHintIdx] = useState(() => Math.floor(Math.random() * CAPTURE_SUGGESTIONS.length));
  const inputRef = useRef<HTMLInputElement>(null);
  const { submit, convertToTask, submitting, error, result, reset } = useCapture(onCaptureSaved, onTaskCreated, onCaptureConverted);

  useEffect(() => {
    if (text) return;
    const id = setInterval(() => setHintIdx((i) => (i + 1) % CAPTURE_SUGGESTIONS.length), 4000);
    return () => clearInterval(id);
  }, [text]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(reset, 7000);
    return () => clearTimeout(t);
  }, [result, reset]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await submit(text);
    if (r) setText('');
  };

  return (
    <div className={`capture-bar ${focused || text ? 'is-focused' : ''} ${submitting ? 'is-busy' : ''}`}>
      <form onSubmit={onSubmit} className="capture-bar-row">
        <span className="capture-bar-glyph">{submitting ? <Spinner size={15} /> : <Sparkles />}</span>
        <div className="palette-input-wrap">
          <input
            ref={inputRef}
            className="capture-bar-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !text && focused) {
                e.preventDefault();
                setText(CAPTURE_SUGGESTIONS[hintIdx]);
              }
              if (e.key === 'Escape') inputRef.current?.blur();
            }}
            disabled={submitting}
            aria-label="Quick capture"
          />
          {!text && (
            <span className="palette-placeholder" key={hintIdx} aria-hidden="true">
              {placeholder ?? 'Capture a task or idea'} — <em>{CAPTURE_SUGGESTIONS[hintIdx]}</em>
            </span>
          )}
        </div>
        {focused && !text && <Kbd>Tab</Kbd>}
        <button type="submit" className="capture-bar-send" disabled={!text.trim() || submitting} aria-label="Capture">
          <ArrowUp />
        </button>
      </form>
      {submitting && <div className="palette-progress" />}

      {(result || error) && (
        <div className={`capture-bar-result ${error ? 'is-error' : ''}`} role="status">
          {error ? (
            <>
              <AlertCircle className="palette-result-icon" />
              <span>{error}</span>
            </>
          ) : result?.createdTask ? (
            <>
              <span className="palette-result-check sm">
                <Check strokeWidth={3} />
              </span>
              <span className="capture-bar-result-title">{result.createdTask.title}</span>
              <QuadrantTag quadrant={result.createdTask.eisenhowerQuadrant} size="sm" />
              <CategoryTag category={result.createdTask.category} size="sm" />
              {result.createdTask.dueAt && <span className="tag tag-sm">{formatDueShort(result.createdTask.dueAt)}</span>}
            </>
          ) : result ? (
            <>
              <span className="palette-result-check sm inbox">
                <Inbox />
              </span>
              <span className="capture-bar-result-title">Saved to Inbox</span>
              {result.suggestedDueAt && <span className="tag tag-ai tag-sm">{formatDueShort(result.suggestedDueAt)}</span>}
              <Button size="sm" variant="soft" onClick={() => convertToTask(result)}>
                Make it a task
              </Button>
            </>
          ) : null}
          <IconButton icon={X} label="Dismiss" size="sm" noTip onClick={reset} className="capture-bar-dismiss" />
        </div>
      )}
    </div>
  );
};
