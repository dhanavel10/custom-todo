import { useEffect, useMemo, useState } from 'react';
import { Plus, Pin, Archive, ArchiveRestore, Trash2, Lightbulb, Feather, SearchX, Layers, LayoutGrid, ChevronDown, ChevronRight } from 'lucide-react';
import type { Note } from '../types';
import { api } from '../lib/api';
import { formatRelativeDate } from '../lib/date';
import { stripMarkdown } from '../lib/markdown';
import { getTopicMeta, groupNotesByTopic, resolveNoteTopic } from '../lib/noteTopics';
import { Button, EmptyState, IconButton, Segmented, Skeleton, useToast } from '../components/ui';
import '../components/NoteEditor/Notes.css';

type Tab = 'all' | 'pinned' | 'archived';
type LayoutMode = 'grouped' | 'flat';

interface Props {
  notes: Note[];
  searchQuery: string;
  onOpen: (note: Note) => void;
  onCreate: () => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

const NoteCard = ({
  note,
  onOpen,
  onPin,
  onArchive,
  onDelete,
  showTopicBadge,
  index
}: {
  note: Note;
  onOpen: () => void;
  onPin?: () => void;
  onArchive: () => void;
  onDelete: () => void;
  showTopicBadge: boolean;
  index: number;
}) => {
  const preview = stripMarkdown(note.content);
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const checklist = (note.content.match(/^\s*[-*+]\s+\[( |x|X)\]/gm) ?? []).length;
  const checked = (note.content.match(/^\s*[-*+]\s+\[(x|X)\]/gm) ?? []).length;
  const { topic, isAuto } = resolveNoteTopic(note);
  const topicMeta = getTopicMeta(topic);
  const TopicIcon = topicMeta.icon;

  return (
    <article className={`note-card ${note.isPinned ? 'is-pinned' : ''}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()} style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      {note.isPinned && (
        <span className="note-pin" aria-label="Pinned">
          <Pin />
        </span>
      )}
      {showTopicBadge && (
        <div className="note-card-topic-row">
          <span className={`tag tag-sm tag-${topicMeta.tone}`} title={isAuto ? `Auto-grouped under ${topic}` : `Topic: ${topic}`}>
            <TopicIcon />
            <span>{topic}</span>
          </span>
        </div>
      )}
      <h3 className={`note-card-title ${note.title ? '' : 'is-untitled'}`}>{note.title || 'Untitled'}</h3>
      {preview ? <p className="note-card-preview">{preview}</p> : <p className="note-card-preview muted">Empty note</p>}
      {checklist > 0 && (
        <div className="note-card-check">
          <span className="progress thin" style={{ flex: 1 }}>
            <span className="progress-fill" style={{ width: `${(checked / checklist) * 100}%`, display: 'block' }} />
          </span>
          <span className="t-meta t-num">
            {checked}/{checklist}
          </span>
        </div>
      )}
      <footer className="note-card-foot">
        <span>{formatRelativeDate(note.updatedAt)}</span>
        {words > 0 && <span>· {words} {words === 1 ? 'word' : 'words'}</span>}
        <div className="note-card-actions" onClick={(e) => e.stopPropagation()}>
          {onPin && <IconButton icon={Pin} label={note.isPinned ? 'Unpin' : 'Pin'} size="sm" tipPos="top" active={note.isPinned} onClick={onPin} />}
          <IconButton icon={note.isArchived ? ArchiveRestore : Archive} label={note.isArchived ? 'Restore' : 'Archive'} size="sm" tipPos="top" onClick={onArchive} />
          <IconButton icon={Trash2} label="Delete" size="sm" tipPos="top" tone="danger" onClick={onDelete} />
        </div>
      </footer>
    </article>
  );
};

export const NotesView = ({ notes, searchQuery, onOpen, onCreate, onUpdateNote, onDeleteNote }: Props) => {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const [layout, setLayout] = useState<LayoutMode>('grouped');
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [archived, setArchived] = useState<Note[] | null>(null);

  const active = useMemo(() => notes.filter((n) => !n.isArchived), [notes]);

  useEffect(() => {
    if (tab !== 'archived') return;
    let cancelled = false;
    setArchived(null);
    api.notes
      .list({ archived: true })
      .then((list) => !cancelled && setArchived(list))
      .catch(() => !cancelled && setArchived([]));
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const q = searchQuery.trim().toLowerCase();
  const source = useMemo(
    () => (tab === 'archived' ? archived ?? [] : tab === 'pinned' ? active.filter((n) => n.isPinned) : active),
    [tab, archived, active]
  );

  const searchFiltered = useMemo(
    () =>
      source.filter(
        (n) =>
          !q ||
          (n.title ?? '').toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          resolveNoteTopic(n).topic.toLowerCase().includes(q)
      ),
    [source, q]
  );

  const topicSummary = useMemo(() => groupNotesByTopic(searchFiltered), [searchFiltered]);
  const activeTopic = selectedTopic === 'ALL' || topicSummary.some((g) => g.topic === selectedTopic) ? selectedTopic : 'ALL';

  const visible = useMemo(
    () => (activeTopic === 'ALL' ? searchFiltered : searchFiltered.filter((n) => resolveNoteTopic(n).topic === activeTopic)),
    [searchFiltered, activeTopic]
  );

  const showPinnedSection = tab === 'all' && activeTopic === 'ALL';
  const pinned = showPinnedSection ? visible.filter((n) => n.isPinned) : [];
  const rest = showPinnedSection ? visible.filter((n) => !n.isPinned) : visible;
  const groupedRest = useMemo(() => groupNotesByTopic(rest), [rest]);

  const toggleGroup = (topic: string) => {
    setCollapsed((prev) => ({ ...prev, [topic]: !prev[topic] }));
  };

  const pin = async (n: Note) => {
    try {
      onUpdateNote(await api.notes.pin(n.id));
    } catch {
      toast({ kind: 'error', title: 'Could not update pin' });
    }
  };

  const archive = async (n: Note) => {
    try {
      const updated = await api.notes.archive(n.id);
      onUpdateNote(updated);
      if (tab === 'archived') setArchived((prev) => (prev ?? []).filter((x) => x.id !== n.id));
      toast({
        kind: 'info',
        title: updated.isArchived ? 'Note archived' : 'Note restored',
        action: { label: 'Undo', onClick: () => void api.notes.archive(n.id).then((u) => onUpdateNote(u)) }
      });
    } catch {
      toast({ kind: 'error', title: 'Could not archive note' });
    }
  };

  const del = (n: Note) => {
    onDeleteNote(n.id);
    if (tab === 'archived') setArchived((prev) => (prev ?? []).filter((x) => x.id !== n.id));
  };

  const renderCard = (n: Note, i: number, showTopicBadge: boolean) => (
    <NoteCard
      key={n.id}
      note={n}
      index={i}
      showTopicBadge={showTopicBadge}
      onOpen={() => onOpen(n)}
      onPin={tab !== 'archived' ? () => pin(n) : undefined}
      onArchive={() => archive(n)}
      onDelete={() => del(n)}
    />
  );

  return (
    <div className="view-enter">
      <div className="toolbar">
        <div className="toolbar-left">
          <Segmented
            value={tab}
            onChange={setTab}
            items={[
              { value: 'all', label: 'All notes', count: active.length },
              { value: 'pinned', label: 'Pinned', icon: Pin, count: active.filter((n) => n.isPinned).length },
              { value: 'archived', label: 'Archived', icon: Archive }
            ]}
          />
          <Segmented
            size="sm"
            value={layout}
            onChange={setLayout}
            items={[
              { value: 'grouped', label: 'Super topics', icon: Layers },
              { value: 'flat', label: 'All grid', icon: LayoutGrid }
            ]}
          />
        </div>
        <Button variant="primary" icon={Plus} onClick={onCreate}>
          New note
        </Button>
      </div>

      {topicSummary.length > 1 && (
        <div className="filter-chips notes-topic-bar" role="tablist" aria-label="Filter by super topic">
          <button className={`chip ${activeTopic === 'ALL' ? 'is-active' : ''}`} onClick={() => setSelectedTopic('ALL')}>
            <span>All topics</span>
            <span className="t-num">{searchFiltered.length}</span>
          </button>
          {topicSummary.map((group) => {
            const Icon = group.meta.icon;
            return (
              <button
                key={group.topic}
                className={`chip ${activeTopic === group.topic ? 'is-active' : ''}`}
                onClick={() => setSelectedTopic(activeTopic === group.topic ? 'ALL' : group.topic)}
              >
                <Icon />
                <span>{group.topic}</span>
                <span className="t-num">{group.notes.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'archived' && archived === null ? (
        <div className="notes-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="note-card" style={{ cursor: 'default' }}>
              <Skeleton w="60%" h={16} />
              <div style={{ height: 10 }} />
              <Skeleton h={10} />
              <div style={{ height: 6 }} />
              <Skeleton w="80%" h={10} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        q ? (
          <EmptyState icon={SearchX} title="No notes match" description={`Nothing in ${tab === 'archived' ? 'the archive' : 'your notes'} mentions “${searchQuery}”.`} />
        ) : tab === 'archived' ? (
          <EmptyState icon={Archive} tone="var(--slate)" title="Archive is empty" description="Notes you archive are tucked away here, out of sight but never lost." />
        ) : tab === 'pinned' ? (
          <EmptyState icon={Pin} title="No pinned notes" description="Pin the notes you return to often and they'll stay at the top." />
        ) : (
          <EmptyState
            icon={Feather}
            tone="var(--amber)"
            title="Your notebook is empty"
            description="A quiet place for half-formed ideas, meeting notes and plans. Markdown welcome."
            action={
              <Button variant="primary" icon={Lightbulb} onClick={onCreate}>
                Write your first note
              </Button>
            }
          />
        )
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <div className="section-head">
                <span className="t-eyebrow">
                  <Pin /> Pinned
                </span>
                <span className="pill">{pinned.length}</span>
                <span className="rule" />
              </div>
              <div className="notes-grid" style={{ marginBottom: 28 }}>
                {pinned.map((n, i) => renderCard(n, i, true))}
              </div>
            </>
          )}

          {layout === 'grouped' ? (
            <div className="note-groups">
              {groupedRest.map((group) => {
                const Icon = group.meta.icon;
                const isCollapsed = Boolean(collapsed[group.topic]);
                return (
                  <section key={group.topic} className="note-group">
                    <button
                      type="button"
                      className="section-head note-group-head"
                      onClick={() => toggleGroup(group.topic)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className={`tag tag-${group.meta.tone}`}>
                        <Icon />
                        <span>{group.topic}</span>
                      </span>
                      <span className="pill">{group.notes.length}</span>
                      <span className="rule" />
                      <span className="note-group-chevron" aria-hidden="true">
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="notes-grid">
                        {group.notes.map((n, i) => renderCard(n, i, false))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              {pinned.length > 0 && rest.length > 0 && (
                <div className="section-head">
                  <span className="t-eyebrow">Everything else</span>
                  <span className="rule" />
                </div>
              )}
              <div className="notes-grid">
                {tab === 'all' && pinned.length === 0 && activeTopic === 'ALL' && (
                  <button className="note-card note-new" onClick={onCreate}>
                    <span className="note-new-icon">
                      <Plus />
                    </span>
                    <span>New note</span>
                  </button>
                )}
                {rest.map((n, i) => renderCard(n, i, true))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
