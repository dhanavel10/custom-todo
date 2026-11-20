import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Maximize2, Pencil, Trash2, Ellipsis, Sparkles, Hash, ChevronDown, ArrowRightLeft, Check, SearchX } from 'lucide-react';
import type { Task, EisenhowerQuadrant, AIStatus } from '../../types';
import { QUADRANTS, QUADRANT_BY_KEY, type QuadrantMeta } from '../../lib/quadrants';
import { AITag, Button, CategoryTag, Dialog, DueTag, IconButton, Menu, MenuItem, MenuLabel, MenuSep, SearchField, Segmented, Spinner, Switch, TaskCheck } from '../ui';
import './EisenhowerMatrix.css';

interface EisenhowerMatrixProps {
  tasks: Task[];
  aiStatus: AIStatus | null;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onMoveQuadrant: (taskId: string, quadrant: EisenhowerQuadrant) => Promise<void>;
  onReanalyzeTask: (taskId: string) => Promise<void>;
  onQuickAdd: (quadrant?: EisenhowerQuadrant) => void;
  onInlineCreateTask?: (title: string, quadrant: EisenhowerQuadrant) => Promise<unknown>;
}

const DRAG_MIME = 'application/x-task-id';
const quadrantOfTask = (t: Task): EisenhowerQuadrant => t.eisenhowerQuadrant || 'DO_FIRST';

/* ---------------- Card ---------------- */

interface CardProps {
  task: Task;
  busy: boolean;
  dragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, q: EisenhowerQuadrant) => void;
  onReanalyze: (id: string) => void;
}

const MatrixCard = ({ task, busy, dragging, onDragStart, onDragEnd, onToggleComplete, onEdit, onDelete, onMove, onReanalyze }: CardProps) => {
  const [showWhy, setShowWhy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const done = task.status === 'COMPLETED';
  const current = quadrantOfTask(task);

  return (
    <div
      className={`mcard ${done ? 'is-done' : ''} ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''} ${menuOpen ? 'is-menu-open' : ''}`}
      draggable={!done}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, task.id);
        e.dataTransfer.setData('text/plain', task.title);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onEdit(task)}
      aria-label={task.title}
    >
      <div className="mcard-top">
        <TaskCheck checked={done} onToggle={() => onToggleComplete(task)} quadrant={current} />
        <div className="mcard-body">
          <div className="mcard-title">
            <span className="task-title-text">{task.title}</span>
          </div>
          {task.description && <div className="mcard-desc">{task.description}</div>}
          <div className="mcard-meta">
            <DueTag task={task} size="sm" />
            <CategoryTag category={task.category} size="sm" />
            {task.aiAnalysis && (
              <AITag
                source={task.aiAnalysis.source}
                active={showWhy}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWhy((v) => !v);
                }}
              />
            )}
          </div>
        </div>
        <div className="mcard-actions" onClick={(e) => e.stopPropagation()}>
          <IconButton icon={RefreshCw} label="Re-analyze with AI" size="sm" spinning={busy} disabled={busy} onClick={() => onReanalyze(task.id)} />
          <Menu width={220} onOpenChange={setMenuOpen} trigger={(p) => <IconButton {...p} icon={Ellipsis} label="More" size="sm" />}>
            {(close) => (
              <>
                <MenuLabel>Move to</MenuLabel>
                {QUADRANTS.map((q) => (
                  <MenuItem
                    key={q.key}
                    swatch={q.color}
                    selected={q.key === current}
                    hint={q.key === current ? <Check size={14} /> : q.code}
                    onSelect={() => {
                      close();
                      if (q.key !== current) onMove(task.id, q.key);
                    }}
                  >
                    {q.name}
                  </MenuItem>
                ))}
                <MenuSep />
                <MenuItem
                  icon={Pencil}
                  onSelect={() => {
                    close();
                    onEdit(task);
                  }}
                >
                  Edit details
                </MenuItem>
                <MenuItem
                  icon={Trash2}
                  danger
                  onSelect={() => {
                    close();
                    onDelete(task.id);
                  }}
                >
                  Delete
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {showWhy && task.aiAnalysis && (
        <div className="ai-why" onClick={(e) => e.stopPropagation()}>
          <div className="ai-why-head">
            <Sparkles /> {task.aiAnalysis.model || task.aiAnalysis.source}
            <span className="ai-why-scores">
              U {task.aiAnalysis.urgencyScore}/10 · I {task.aiAnalysis.importanceScore}/10
            </span>
          </div>
          <div className="ai-why-bars">
            <span>Urgency</span>
            <i>
              <b style={{ width: `${task.aiAnalysis.urgencyScore * 10}%` }} />
            </i>
            <span>Importance</span>
            <i>
              <b style={{ width: `${task.aiAnalysis.importanceScore * 10}%` }} />
            </i>
          </div>
          <p>{task.aiAnalysis.reasoning}</p>
        </div>
      )}
    </div>
  );
};

/* ---------------- Inline add ---------------- */

const InlineAdd = ({ quadrant, onCreate, onDetailed, autoOpen }: { quadrant: QuadrantMeta; onCreate?: (title: string) => Promise<unknown>; onDetailed: () => void; autoOpen?: boolean }) => {
  const [open, setOpen] = useState(!!autoOpen);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!onCreate) {
    return (
      <button className="q-add" onClick={onDetailed}>
        <Plus /> Add to {quadrant.name}
      </button>
    );
  }

  if (!open) {
    return (
      <button className="q-add" onClick={() => setOpen(true)}>
        <Plus /> Add to {quadrant.name}
      </button>
    );
  }

  return (
    <form
      className="inline-add q-inline"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || saving) return;
        setSaving(true);
        try {
          await onCreate(title.trim());
          setTitle('');
        } finally {
          setSaving(false);
          ref.current?.focus();
        }
      }}
    >
      {saving ? <Spinner size={14} /> : <Plus className="inline-add-icon" />}
      <input
        ref={ref}
        className="inline-add-input"
        placeholder={`New ${quadrant.name.toLowerCase()} task…`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && !autoOpen && setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (title) {
              e.stopPropagation();
              setTitle('');
            } else if (!autoOpen) {
              e.stopPropagation();
              setOpen(false);
            }
            // empty + always-open (focus dialog): let Escape close the dialog
          }
        }}
        aria-label={`New task in ${quadrant.name}`}
      />
      <IconButton icon={Maximize2} label="Add with details" size="sm" tipPos="top" onMouseDown={(e) => e.preventDefault()} onClick={onDetailed} />
    </form>
  );
};

/* ---------------- Matrix ---------------- */

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
  const [category, setCategory] = useState<string>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overQ, setOverQ] = useState<EisenhowerQuadrant | null>(null);
  const [mobileQ, setMobileQ] = useState<EisenhowerQuadrant>('DO_FIRST');
  const [focusQ, setFocusQ] = useState<EisenhowerQuadrant | null>(null);
  const [focusSearch, setFocusSearch] = useState('');
  const touchX = useRef<number | null>(null);

  const categories = useMemo(() => Array.from(new Set(tasks.filter((t) => t.status !== 'ARCHIVED').map((t) => t.category || 'General'))).sort(), [tasks]);

  const byQuadrant = useMemo(() => {
    const map: Record<EisenhowerQuadrant, Task[]> = { DO_FIRST: [], SCHEDULE: [], DELEGATE: [], ELIMINATE: [] };
    for (const t of tasks) {
      if (t.status === 'ARCHIVED') continue;
      if (!showCompleted && t.status === 'COMPLETED') continue;
      if (category !== 'ALL' && (t.category || 'General') !== category) continue;
      map[quadrantOfTask(t)].push(t);
    }
    // open tasks first, then by due date
    for (const k of Object.keys(map) as EisenhowerQuadrant[]) {
      map[k].sort((a, b) => Number(a.status === 'COMPLETED') - Number(b.status === 'COMPLETED') || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity));
    }
    return map;
  }, [tasks, showCompleted, category]);

  const openCount = (k: EisenhowerQuadrant) => byQuadrant[k].filter((t) => t.status !== 'COMPLETED').length;
  const totalOpen = QUADRANTS.reduce((n, q) => n + openCount(q.key), 0);

  const reanalyze = async (id: string) => {
    setBusyId(id);
    try {
      await onReanalyzeTask(id);
    } finally {
      setBusyId(null);
    }
  };

  const move = (id: string, q: EisenhowerQuadrant) => void onMoveQuadrant(id, q);

  const drop = (e: React.DragEvent, q: EisenhowerQuadrant) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME);
    setOverQ(null);
    setDragId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (task && quadrantOfTask(task) !== q) move(id, q);
  };

  const cardProps = {
    onDragStart: setDragId,
    onDragEnd: () => {
      setDragId(null);
      setOverQ(null);
    },
    onToggleComplete,
    onEdit: onEditTask,
    onDelete: onDeleteTask,
    onMove: move,
    onReanalyze: reanalyze
  };

  const renderCards = (list: Task[]) =>
    list.map((t) => <MatrixCard key={t.id} task={t} busy={busyId === t.id} dragging={dragId === t.id} {...cardProps} />);

  const focusMeta = focusQ ? QUADRANT_BY_KEY[focusQ] : null;
  const focusList = focusQ
    ? byQuadrant[focusQ].filter((t) => {
        const s = focusSearch.trim().toLowerCase();
        return !s || t.title.toLowerCase().includes(s) || (t.description ?? '').toLowerCase().includes(s);
      })
    : [];

  const cycleMobile = (dir: 1 | -1) => {
    const i = QUADRANTS.findIndex((q) => q.key === mobileQ);
    setMobileQ(QUADRANTS[(i + dir + 4) % 4].key);
  };

  return (
    <div className="matrix view-enter">
      <div className="matrix-toolbar">
        <div className="matrix-toolbar-left">
          <span className={`ai-pill ${aiStatus?.connected ? 'is-on' : ''}`} data-tip={aiStatus?.connected ? `Ollama at ${aiStatus.baseUrl}` : aiStatus?.error || 'Ollama unreachable — using offline NLP classification'}>
            <span className={`status-dot ${aiStatus?.connected ? 'live' : 'warn'}`} />
            <Sparkles />
            <span>{aiStatus?.connected ? aiStatus.model : 'NLP fallback'}</span>
          </span>
          <span className="t-meta t-num hide-sm">
            {totalOpen} open across 4 quadrants
          </span>
        </div>
        <div className="matrix-toolbar-right">
          {categories.length > 1 && (
            <Menu
              width={220}
              trigger={(p) => (
                <Button {...p} size="sm" variant={category === 'ALL' ? 'ghost' : 'soft'} icon={Hash} iconRight={ChevronDown}>
                  {category === 'ALL' ? 'All categories' : category}
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Category</MenuLabel>
                  <MenuItem
                    selected={category === 'ALL'}
                    onSelect={() => {
                      setCategory('ALL');
                      close();
                    }}
                  >
                    All categories
                  </MenuItem>
                  {categories.map((c) => (
                    <MenuItem
                      key={c}
                      icon={Hash}
                      selected={category === c}
                      onSelect={() => {
                        setCategory(c);
                        close();
                      }}
                    >
                      {c}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          )}
          <Switch checked={showCompleted} onChange={setShowCompleted} label="Completed" />
        </div>
      </div>

      {/* Mobile quadrant navigator: a miniature matrix */}
      <div className="matrix-mini" role="tablist" aria-label="Quadrants">
        {QUADRANTS.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.key}
              role="tab"
              aria-selected={mobileQ === q.key}
              className={`mini-q ${mobileQ === q.key ? 'is-active' : ''}`}
              style={{ ['--q' as string]: q.color }}
              onClick={() => setMobileQ(q.key)}
            >
              <Icon />
              <span className="mini-q-name">{q.name}</span>
              <span className="mini-q-count">{openCount(q.key)}</span>
            </button>
          );
        })}
      </div>

      <div className="matrix-board" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOverQ(null)}>
        <div className="axis axis-top" aria-hidden="true">
          <span>Urgent</span>
          <span>Not urgent</span>
        </div>
        <div className="axis axis-left" aria-hidden="true">
          <span>Important</span>
          <span>Not important</span>
        </div>

        <div
          className="matrix-grid"
          data-mobile={mobileQ}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 70 && window.innerWidth < 760) cycleMobile(dx < 0 ? 1 : -1);
          }}
        >
          {QUADRANTS.map((q) => {
            const list = byQuadrant[q.key];
            const Icon = q.icon;
            const isOver = overQ === q.key && dragId !== null;
            const dragSourceQ = dragId ? quadrantOfTask(tasks.find((t) => t.id === dragId) ?? ({} as Task)) : null;
            return (
              <section
                key={q.key}
                className={`quadrant ${isOver && dragSourceQ !== q.key ? 'is-drop' : ''} ${dragId ? 'is-dragging' : ''}`}
                data-q={q.key}
                style={{ ['--q' as string]: q.color, ['--q-soft' as string]: q.soft }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overQ !== q.key) setOverQ(q.key);
                }}
                onDrop={(e) => drop(e, q.key)}
                aria-label={`${q.name}: ${q.tagline}`}
              >
                <header className="q-head">
                  <span className="q-icon">
                    <Icon />
                  </span>
                  <div className="q-titles">
                    <div className="q-name">
                      {q.name}
                      <span className="q-code">{q.code}</span>
                    </div>
                    <div className="q-tagline">{q.tagline}</div>
                  </div>
                  <span className="q-count t-num">{openCount(q.key)}</span>
                  <div className="q-head-actions">
                    <IconButton
                      icon={Maximize2}
                      label="Focus view"
                      size="sm"
                      onClick={() => {
                        setFocusQ(q.key);
                        setFocusSearch('');
                      }}
                    />
                    <IconButton icon={Plus} label="Add with details" size="sm" onClick={() => onQuickAdd(q.key)} />
                  </div>
                </header>

                <div className="q-body">
                  {list.length === 0 ? (
                    <div className="q-empty">
                      <span className="q-empty-icon">
                        <Icon />
                      </span>
                      <strong>{q.emptyTitle}</strong>
                      <span>{q.description}</span>
                    </div>
                  ) : (
                    renderCards(list)
                  )}
                  {isOver && dragSourceQ !== q.key && (
                    <div className="q-drop-hint">
                      <ArrowRightLeft /> Drop to move into {q.name}
                    </div>
                  )}
                </div>

                <footer className="q-foot">
                  <InlineAdd quadrant={q} onCreate={onInlineCreateTask ? (title) => onInlineCreateTask(title, q.key) : undefined} onDetailed={() => onQuickAdd(q.key)} />
                </footer>
              </section>
            );
          })}
        </div>
      </div>

      {/* Focus dialog for a single quadrant */}
      <Dialog
        open={!!focusQ}
        onClose={() => setFocusQ(null)}
        width={720}
        icon={focusMeta?.icon}
        iconTone={focusMeta?.color}
        title={focusMeta ? `${focusMeta.name}` : ''}
        subtitle={focusMeta ? `${focusMeta.code} · ${focusMeta.tagline} — ${focusMeta.verb.toLowerCase()}.` : ''}
        className="focus-dialog"
        bare
      >
        {focusMeta && (
          <>
            <div className="focus-controls">
              <Segmented
                size="sm"
                value={focusMeta.key}
                onChange={(k) => {
                  setFocusQ(k);
                  setFocusSearch('');
                }}
                items={QUADRANTS.map((q) => ({ value: q.key, label: q.name, count: openCount(q.key) }))}
              />
              <SearchField value={focusSearch} onChange={setFocusSearch} placeholder={`Filter ${focusMeta.name}`} className="focus-search" />
            </div>
            <div className="focus-body" style={{ ['--q' as string]: focusMeta.color, ['--q-soft' as string]: focusMeta.soft }}>
              {focusList.length === 0 ? (
                <div className="q-empty">
                  <span className="q-empty-icon">{focusSearch ? <SearchX /> : <focusMeta.icon />}</span>
                  <strong>{focusSearch ? 'No matching tasks' : focusMeta.emptyTitle}</strong>
                  <span>{focusSearch ? 'Try a different search.' : focusMeta.description}</span>
                </div>
              ) : (
                renderCards(focusList)
              )}
            </div>
            <div className="dialog-footer" style={{ ['--q' as string]: focusMeta.color }}>
              <div style={{ flex: 1 }}>
                <InlineAdd key={focusMeta.key} quadrant={focusMeta} autoOpen onCreate={onInlineCreateTask ? (title) => onInlineCreateTask(title, focusMeta.key) : undefined} onDetailed={() => onQuickAdd(focusMeta.key)} />
              </div>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};
