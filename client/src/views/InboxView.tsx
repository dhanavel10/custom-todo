import { useState } from 'react';
import { ListTodo, FileText, Trash2, Sparkles, CircleHelp, Inbox, PartyPopper, AlertTriangle } from 'lucide-react';
import type { Capture, Task } from '../types';
import { formatDueShort, formatRelativeDate } from '../lib/date';
import { Button, EmptyState, IconButton } from '../components/ui';
import { QuickCapture } from '../components/QuickCapture/QuickCapture';

interface Props {
  captures: Capture[];
  searchQuery: string;
  onConvertToTask: (c: Capture) => Promise<void>;
  onConvertToNote: (c: Capture) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCaptureSaved: (c: Capture) => void;
  onTaskCreated: (t: Task) => void;
  onCaptureConverted: (id: string) => void;
}

const TYPE_META = {
  TASK: { icon: ListTodo, label: 'Looks like a task', cls: 'task' },
  NOTE: { icon: FileText, label: 'Looks like a note', cls: 'note' },
  UNKNOWN: { icon: CircleHelp, label: 'Unclassified', cls: '' }
} as const;

const CaptureCard = ({ cap, onConvertToTask, onConvertToNote, onDelete }: { cap: Capture } & Pick<Props, 'onConvertToTask' | 'onConvertToNote' | 'onDelete'>) => {
  const [busy, setBusy] = useState<'task' | 'note' | 'delete' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const meta = TYPE_META[cap.detectedType] ?? TYPE_META.UNKNOWN;
  const Icon = meta.icon;
  const showSuggestedTitle = cap.suggestedTitle && cap.suggestedTitle.trim().toLowerCase() !== cap.rawText.trim().toLowerCase();

  const act = async (kind: 'task' | 'note' | 'delete', fn: () => Promise<void>) => {
    setBusy(kind);
    setLeaving(true);
    await new Promise((r) => setTimeout(r, 180));
    try {
      await fn();
    } finally {
      setBusy(null);
      setLeaving(false);
    }
  };

  return (
    <article className={`capture-card ${leaving ? 'is-leaving' : ''}`}>
      <span className={`capture-type ${meta.cls}`} title={meta.label}>
        <Icon />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="capture-raw">{cap.rawText}</div>
        <div className="capture-ai">
          <span className="capture-ai-label">
            <Sparkles /> Detected
          </span>
          <span className={`tag tag-sm ${cap.detectedType === 'TASK' ? 'tag-primary' : cap.detectedType === 'NOTE' ? 'tag-amber' : ''}`}>
            {cap.detectedType === 'UNKNOWN' ? 'Unknown type' : cap.detectedType.charAt(0) + cap.detectedType.slice(1).toLowerCase()}
          </span>
          {cap.suggestedDueAt && <span className="tag tag-sm tag-ai">{formatDueShort(cap.suggestedDueAt)}</span>}
          {cap.parseStatus === 'NEEDS_REVIEW' && (
            <span className="tag tag-sm tag-warning">
              <AlertTriangle />
              <span>Confirm date</span>
            </span>
          )}
          {cap.parseStatus === 'FAILED' && <span className="tag tag-sm tag-error">Parse failed</span>}
          {showSuggestedTitle && (
            <span className="capture-suggested-title">
              → <b>{cap.suggestedTitle}</b>
            </span>
          )}
        </div>
        <div className="capture-foot">
          <span className="t-meta">Captured {formatRelativeDate(cap.createdAt)}</span>
          <Button size="sm" variant="soft" icon={ListTodo} loading={busy === 'task'} disabled={!!busy} onClick={() => act('task', () => onConvertToTask(cap))}>
            To task
          </Button>
          <Button size="sm" variant="secondary" icon={FileText} loading={busy === 'note'} disabled={!!busy} onClick={() => act('note', () => onConvertToNote(cap))}>
            To note
          </Button>
          <IconButton icon={Trash2} label="Delete capture" size="sm" tone="danger" disabled={!!busy} onClick={() => act('delete', () => onDelete(cap.id))} />
        </div>
      </div>
    </article>
  );
};

export const InboxView = ({ captures, searchQuery, onCaptureSaved, onTaskCreated, onCaptureConverted, ...actions }: Props) => {
  const q = searchQuery.trim().toLowerCase();
  const list = q ? captures.filter((c) => c.rawText.toLowerCase().includes(q) || (c.suggestedTitle ?? '').toLowerCase().includes(q)) : captures;

  return (
    <div className="view-enter">
      <QuickCapture onCaptureSaved={onCaptureSaved} onTaskCreated={onTaskCreated} onCaptureConverted={onCaptureConverted} placeholder="Dump it here" />

      <div className="toolbar">
        <div className="toolbar-left">
          <h2 className="t-section">Unprocessed</h2>
          <span className="count primary">{list.length}</span>
        </div>
        <div className="inbox-explainer">
          <span className="raw">
            <i /> Raw capture
          </span>
          <span className="org">
            <i /> Organized task
          </span>
        </div>
      </div>

      {list.length === 0 ? (
        q ? (
          <EmptyState icon={Inbox} title="No captures match" description={`Nothing in your inbox mentions “${searchQuery}”.`} />
        ) : (
          <EmptyState
            icon={PartyPopper}
            tone="var(--green)"
            title="Inbox zero"
            description="Everything you've captured has been organized. Thoughts that AI can't place on its own will land here."
          />
        )
      ) : (
        <div className="inbox-list">
          {list.map((cap, i) => (
            <div key={cap.id} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <CaptureCard cap={cap} {...actions} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
