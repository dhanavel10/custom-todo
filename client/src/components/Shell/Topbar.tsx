import { useEffect, useRef, useState } from 'react';
import { Bell, Menu as MenuIcon, Moon, Plus, Search, Settings, Sun, Sparkles, X, type LucideIcon } from 'lucide-react';
import { Button, IconButton, Kbd, SearchField, isMac } from '../ui';

interface TopbarProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  searchQuery: string;
  onSearch: (q: string) => void;
  searchPlaceholder: string;
  showSearch: boolean;
  onAddTask: () => void;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenMobileNav: () => void;
}

export const Topbar = ({
  title,
  subtitle,
  icon: Icon,
  searchQuery,
  onSearch,
  searchPlaceholder,
  showSearch,
  onAddTask,
  onOpenPalette,
  onOpenNotifications,
  unreadCount,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenMobileNav
}: TopbarProps) => {
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search (when not typing somewhere else)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!showSearch) return;
      e.preventDefault();
      if (window.innerWidth < 720) {
        setMobileSearch(true);
        setTimeout(() => mobileSearchRef.current?.focus(), 30);
      } else searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSearch]);

  return (
    <header className={`topbar ${mobileSearch ? 'is-searching' : ''}`}>
      <div className="topbar-left">
        <IconButton className="mobile-nav-btn" icon={MenuIcon} label="Open menu" noTip onClick={onOpenMobileNav} />
        <div className="page-heading" key={title}>
          <span className="page-icon">
            <Icon />
          </span>
          <div className="page-heading-text">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <button className="capture-trigger" onClick={onOpenPalette} aria-label="Quick capture">
          <Sparkles />
          <span className="capture-trigger-text">Capture anything…</span>
          <span className="capture-trigger-keys">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        {showSearch && (
          <SearchField
            className="topbar-search"
            value={searchQuery}
            onChange={onSearch}
            placeholder={searchPlaceholder}
            inputRef={searchRef}
            hint={<Kbd>/</Kbd>}
          />
        )}
        {showSearch && <IconButton className="mobile-search-btn" icon={Search} label="Search" badge={!!searchQuery} onClick={() => { setMobileSearch(true); setTimeout(() => mobileSearchRef.current?.focus(), 30); }} />}

        <div className="topbar-icons">
          <IconButton icon={Bell} label="Notifications" badge={unreadCount > 0} onClick={onOpenNotifications} />
          <IconButton className="theme-toggle" icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme} />
          <IconButton className="hide-sm" icon={Settings} label="Settings" onClick={onOpenSettings} />
        </div>

        <Button variant="primary" icon={Plus} className="add-task-btn" onClick={onAddTask} aria-label="Add task">
          <span className="hide-sm">Add task</span>
        </Button>
      </div>

      {mobileSearch && showSearch && (
        <div className="mobile-search-row">
          <SearchField value={searchQuery} onChange={onSearch} placeholder={searchPlaceholder} inputRef={mobileSearchRef} autoFocus />
          <IconButton icon={X} label="Close search" noTip onClick={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
};
