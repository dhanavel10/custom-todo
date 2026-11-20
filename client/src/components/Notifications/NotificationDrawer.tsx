import { X, CheckCheck, Bell, BellRing, GraduationCap, Sunrise, BellOff } from 'lucide-react';
import { formatRelativeDate, isSameDay } from '../../lib/date';
import type { Notification } from '../../types';
import { Button, Drawer, EmptyState, IconButton } from '../ui';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

/** Pick an icon/tone from the notification text (the API has no type field). */
function toneOf(n: Notification) {
  const text = `${n.title} ${n.body}`.toLowerCase();
  if (/study|plan|session|concept/.test(text)) return { icon: GraduationCap, cls: 'tone-study' };
  if (/morning|evening|review|briefing|wrap/.test(text)) return { icon: Sunrise, cls: 'tone-review' };
  return { icon: BellRing, cls: '' };
}

export const NotificationDrawer = ({ isOpen, onClose, notifications, onMarkRead, onMarkAllRead }: NotificationDrawerProps) => {
  const unread = notifications.filter((n) => !n.readAt);
  const now = new Date();
  const today = notifications.filter((n) => isSameDay(new Date(n.createdAt), now));
  const earlier = notifications.filter((n) => !isSameDay(new Date(n.createdAt), now));

  const item = (n: Notification, i: number) => {
    const isUnread = !n.readAt;
    const { icon: Icon, cls } = toneOf(n);
    return (
      <div
        key={n.id}
        className={`notif-item ${isUnread ? 'is-unread' : ''} ${cls}`}
        onClick={() => isUnread && onMarkRead(n.id)}
        role={isUnread ? 'button' : undefined}
        tabIndex={isUnread ? 0 : undefined}
        onKeyDown={(e) => isUnread && e.key === 'Enter' && onMarkRead(n.id)}
        style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
        title={isUnread ? 'Mark as read' : undefined}
      >
        {isUnread && <span className="notif-unread-dot" />}
        <span className="notif-icon">
          <Icon />
        </span>
        <div className="notif-body">
          <div className="notif-title">
            <span>{n.title}</span>
            <span className="notif-time">{formatRelativeDate(n.createdAt)}</span>
          </div>
          <div className="notif-text">{n.body}</div>
        </div>
      </div>
    );
  };

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      label="Notifications"
      header={
        <>
          <Bell size={17} />
          <span className="t-section" style={{ flex: 1 }}>
            Notifications
          </span>
          {unread.length > 0 && <span className="count primary">{unread.length} new</span>}
          {unread.length > 0 && (
            <Button size="sm" variant="ghost" icon={CheckCheck} onClick={onMarkAllRead}>
              Mark all read
            </Button>
          )}
          <IconButton icon={X} label="Close" noTip onClick={onClose} />
        </>
      }
    >
      {notifications.length === 0 ? (
        <EmptyState icon={BellOff} title="All caught up" description="Reminders, daily reviews and study nudges will appear here." />
      ) : (
        <>
          {today.length > 0 && (
            <>
              <div className="notif-group-label t-eyebrow">Today</div>
              {today.map(item)}
            </>
          )}
          {earlier.length > 0 && (
            <>
              <div className="notif-group-label t-eyebrow">Earlier</div>
              {earlier.map((n, i) => item(n, i + today.length))}
            </>
          )}
        </>
      )}
    </Drawer>
  );
};
