import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, LogIn, X } from 'lucide-react';
import type { AIStatus, User } from '../../types';
import { NAV_GROUPS, type ViewMode } from '../../lib/nav';
import { IconButton } from '../ui';
import { BrandMark } from './BrandMark';

export interface NavCounts {
  today: number;
  inbox: number;
  overdue: number;
  notes: number;
  missed: number;
  upcoming: number;
}

interface SidebarProps {
  current: ViewMode;
  onNavigate: (v: ViewMode) => void;
  counts: NavCounts;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: User | null;
  aiStatus: AIStatus | null;
  onSignOut: () => void;
  onSignIn: () => void;
  onOpenSettings: () => void;
}

function badgeFor(view: ViewMode, c: NavCounts): { n: number; tone?: 'danger' | 'primary' } | null {
  switch (view) {
    case 'today':
      return c.today ? { n: c.today, tone: 'primary' } : null;
    case 'inbox':
      return c.inbox ? { n: c.inbox } : null;
    case 'upcoming':
      return c.upcoming ? { n: c.upcoming } : null;
    case 'overdue':
      return c.overdue ? { n: c.overdue, tone: 'danger' } : null;
    case 'notes':
      return c.notes ? { n: c.notes } : null;
    case 'plans':
      return c.missed ? { n: c.missed, tone: 'danger' } : null;
    default:
      return null;
  }
}

export const Sidebar = ({
  current,
  onNavigate,
  counts,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  user,
  aiStatus,
  onSignOut,
  onSignIn,
  onOpenSettings
}: SidebarProps) => {
  const name = user?.displayName || user?.email || '';
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <>
      <div className={`sidebar-scrim ${mobileOpen ? 'is-open' : ''}`} onClick={onCloseMobile} aria-hidden="true" />
      <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <div className="brand">
            <BrandMark />
            <div className="brand-text">
              <span className="brand-name">Productivity Inbox</span>
              <span className="brand-sub">
                <span className={`status-dot ${aiStatus?.connected ? 'live' : 'warn'}`} />
                {aiStatus?.connected ? 'AI connected' : 'Offline NLP mode'}
              </span>
            </div>
          </div>
          <IconButton className="sidebar-collapse" icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} size="sm" tipPos="right" onClick={onToggleCollapsed} />
          <IconButton className="sidebar-close" icon={X} label="Close menu" size="sm" noTip onClick={onCloseMobile} />
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = current === item.view;
                const badge = badgeFor(item.view, counts);
                return (
                  <button
                    key={item.view}
                    className={`nav-item ${active ? 'is-active' : ''} ${item.view === 'overdue' && counts.overdue ? 'is-alert' : ''}`}
                    onClick={() => onNavigate(item.view)}
                    aria-current={active ? 'page' : undefined}
                    data-tip={collapsed ? item.label : undefined}
                    data-tip-pos="right"
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{item.label}</span>
                    {badge && <span className={`nav-count ${badge.tone ?? ''}`}>{badge.n > 99 ? '99+' : badge.n}</span>}
                    {badge && <span className={`nav-pip ${badge.tone ?? ''}`} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {user ? (
            <div className="profile">
              <span className="avatar">{initials || '·'}</span>
              <div className="profile-text">
                <span className="profile-name">{user.displayName || 'Your workspace'}</span>
                <span className="profile-email">{user.email}</span>
              </div>
              <div className="profile-actions">
                <IconButton icon={Settings} label="Settings" size="sm" tipPos="top" onClick={onOpenSettings} />
                <IconButton icon={LogOut} label="Sign out" size="sm" tipPos="top" onClick={onSignOut} />
              </div>
            </div>
          ) : (
            <button className="nav-item" onClick={onSignIn}>
              <span className="nav-icon">
                <LogIn />
              </span>
              <span className="nav-label">Sign in</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
