import { X, CheckCheck, Bell } from 'lucide-react';
import { formatRelativeDate } from '../../lib/date';
import type { Notification } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

export const NotificationDrawer = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead
}: NotificationDrawerProps) => {
  if (!isOpen) return null;

  return (
    <div className="drawer">
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Bell size={16} /> Notifications
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {notifications.some((n) => !n.readAt) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={onMarkAllRead}
              title="Mark all notifications read"
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={24} className="empty-state-icon" />
            <div className="empty-state-title">No notifications</div>
            <div className="empty-state-desc">You're all caught up!</div>
          </div>
        ) : (
          notifications.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isUnread ? 'var(--bg-tertiary)' : 'transparent',
                  border: '1px solid var(--border)',
                  marginBottom: 8,
                  cursor: isUnread ? 'pointer' : 'default',
                  transition: 'var(--transition)'
                }}
                onClick={() => {
                  if (isUnread) onMarkRead(n.id);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: isUnread ? 600 : 500, color: 'var(--text-primary)' }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatRelativeDate(n.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {n.body}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
