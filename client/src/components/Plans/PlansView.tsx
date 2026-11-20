import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, GraduationCap, Ellipsis, ArrowUpRight, CalendarClock, AlertTriangle, BookOpenCheck } from 'lucide-react';
import type { NewPlanItem, Plan, PlanSummary } from '../../types';
import { api } from '../../lib/api';
import { formatDueShort } from '../../lib/date';
import { nextItem, planStatus } from '../../lib/plans';
import { Button, EmptyState, IconButton, Menu, MenuItem, ProgressRing, Skeleton, useConfirm } from '../ui';
import { NewPlanDialog } from './NewPlanDialog';
import './Plans.css';

interface Props {
  plans: PlanSummary[];
  onCreate: (body: { title: string; description?: string; items: NewPlanItem[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpen: (id: string) => void;
}

const MAX_DOTS = 42;

export const PlansView = ({ plans, onCreate, onDelete, onOpen }: Props) => {
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [details, setDetails] = useState<Record<string, Plan>>({});

  // Load item-level detail for each plan so cards can show the next concept and a status map
  const signature = useMemo(() => plans.map((p) => `${p.id}:${p.completedItems}:${p.missedItems}:${p.totalItems}:${p.nextItemAt}`).join('|'), [plans]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(plans.map((p) => api.plans.get(p.id).catch(() => null))).then((list) => {
      if (cancelled) return;
      const map: Record<string, Plan> = {};
      for (const p of list) if (p) map[p.id] = p;
      setDetails(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const totals = useMemo(() => {
    const t = plans.reduce((a, p) => ({ items: a.items + p.totalItems, done: a.done + p.completedItems, missed: a.missed + p.missedItems }), { items: 0, done: 0, missed: 0 });
    return { ...t, pct: t.items ? Math.round((t.done / t.items) * 100) : 0 };
  }, [plans]);

  return (
    <div className="view-enter">
      <div className="plans-head">
        <div>
          <h2 className="t-page">Learn, one day at a time</h2>
          <p className="t-caption">Break a topic into daily concepts. You'll get a reminder at each session, and a nudge to reschedule anything you miss.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
          New plan
        </Button>
      </div>

      {plans.length > 0 && (
        <div className="plans-overview">
          <div>
            <b className="t-num">{plans.length}</b>
            <span>active {plans.length === 1 ? 'plan' : 'plans'}</span>
          </div>
          <div>
            <b className="t-num">
              {totals.done}
              <em>/{totals.items}</em>
            </b>
            <span>concepts learned</span>
          </div>
          <div className={totals.missed ? 'is-alert' : ''}>
            <b className="t-num">{totals.missed}</b>
            <span>missed sessions</span>
          </div>
          <div className="plans-overview-bar">
            <span className="progress">
              <span className="progress-fill" style={{ width: `${totals.pct}%`, display: 'block' }} />
            </span>
            <span className="t-meta t-num">{totals.pct}% overall</span>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No study plans yet"
          description="Paste a list of topics — one per line — and we'll lay them out across days with reminders."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
              Create your first plan
            </Button>
          }
        />
      ) : (
        <div className="plans-grid">
          {plans.map((plan, i) => {
            const pct = plan.totalItems ? Math.round((plan.completedItems / plan.totalItems) * 100) : 0;
            const st = planStatus(plan);
            const detail = details[plan.id];
            const next = detail ? nextItem(detail) : null;
            const items = detail ? [...detail.items].sort((a, b) => a.dayNumber - b.dayNumber || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)) : [];
            return (
              <article
                key={plan.id}
                className={`plan-card status-${st.key}`}
                style={{ ['--plan-c' as string]: st.tone, animationDelay: `${i * 50}ms` }}
                onClick={() => onOpen(plan.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(plan.id)}
              >
                <header className="plan-card-head">
                  <span className={`tag tag-sm tag-dot ${st.tag}`}>
                    <span>{st.label}</span>
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Menu trigger={(p) => <IconButton {...p} icon={Ellipsis} label="Plan options" size="sm" />}>
                      {(close) => (
                        <>
                          <MenuItem
                            icon={ArrowUpRight}
                            onSelect={() => {
                              close();
                              onOpen(plan.id);
                            }}
                          >
                            Open plan
                          </MenuItem>
                          <MenuItem
                            icon={Trash2}
                            danger
                            onSelect={async () => {
                              close();
                              const ok = await confirm({ title: `Delete “${plan.title}”?`, message: 'This removes the plan and all of its scheduled concepts. This cannot be undone.', confirmLabel: 'Delete plan', danger: true });
                              if (ok) await onDelete(plan.id);
                            }}
                          >
                            Delete plan
                          </MenuItem>
                        </>
                      )}
                    </Menu>
                  </div>
                </header>

                <div className="plan-card-main">
                  <div className="plan-card-text">
                    <h3>{plan.title}</h3>
                    {plan.description && <p>{plan.description}</p>}
                    <div className="plan-card-stats">
                      <span>
                        <b>{plan.completedItems}</b>/{plan.totalItems} done
                      </span>
                      {plan.missedItems > 0 && (
                        <span className="is-alert">
                          <AlertTriangle size={12} /> {plan.missedItems} missed
                        </span>
                      )}
                    </div>
                  </div>
                  <ProgressRing value={pct} size={64} stroke={6} color={st.tone} label={`${pct}%`} labelSize={14} />
                </div>

                <div className="plan-dots" aria-hidden="true">
                  {detail
                    ? items.slice(0, MAX_DOTS).map((it) => <i key={it.id} className={`dot-${it.status.toLowerCase()} ${next?.id === it.id ? 'is-next' : ''}`} title={`Day ${it.dayNumber}: ${it.title}`} />)
                    : Array.from({ length: Math.min(plan.totalItems, MAX_DOTS) }).map((_, j) => <i key={j} className="dot-skeleton" />)}
                  {plan.totalItems > MAX_DOTS && <em>+{plan.totalItems - MAX_DOTS}</em>}
                </div>

                <footer className="plan-card-foot">
                  {st.key === 'done' ? (
                    <span className="plan-next done">
                      <BookOpenCheck /> Every concept covered
                    </span>
                  ) : detail ? (
                    next ? (
                      <span className="plan-next">
                        <CalendarClock />
                        <span className="plan-next-label">Next</span>
                        <span className="plan-next-title">{next.title}</span>
                        <span className="plan-next-when">{formatDueShort(next.scheduledAt)}</span>
                      </span>
                    ) : (
                      <span className="plan-next muted">No upcoming sessions</span>
                    )
                  ) : (
                    <Skeleton w="70%" h={12} />
                  )}
                </footer>
              </article>
            );
          })}
          <button className="plan-card plan-new" onClick={() => setShowForm(true)}>
            <span className="note-new-icon">
              <Plus />
            </span>
            <span>Start a new plan</span>
          </button>
        </div>
      )}

      <NewPlanDialog open={showForm} onClose={() => setShowForm(false)} onCreate={onCreate} />
    </div>
  );
};
