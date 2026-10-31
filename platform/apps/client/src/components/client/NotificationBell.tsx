import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../../lib/http';
import { analytics } from '../../lib/analytics';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  onNavigate: (route: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=10');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    setOpen(false);
    
    // Track notification click
    analytics.track('NotificationClicked', {
      notificationId: notification.id,
      type: notification.type,
    });
    
    // Navigate based on notification type
    if (notification.payload?.taskId) {
      onNavigate(`/tasks/${notification.payload.taskId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_IN_REVIEW':
        return '👀';
      case 'TASK_COMPLETED':
        return '✅';
      case 'REVISION_REQUESTED':
        return '🔄';
      default:
        return '📣';
    }
  };

  const handleToggleOpen = () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (newOpen) {
      analytics.track('NotificationsOpened', { unreadCount });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--accent)] transition"
      >
        <Bell className="h-4 w-4 text-[color:var(--muted-foreground)]" />
        <span className="sr-only">Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[10px] font-medium flex items-center justify-center border border-[color:var(--card)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
            <span className="text-[13px] font-medium text-[color:var(--foreground)]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-[color:var(--primary)] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[color:var(--muted-foreground)]">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[color:var(--muted-foreground)]">
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-4 py-3 text-left flex gap-3 hover:bg-[color:var(--accent)] transition border-b border-[color:var(--border)] last:border-b-0 ${
                    !notification.read ? 'bg-[color:var(--accent)]/50' : ''
                  }`}
                >
                  <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] truncate ${!notification.read ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--foreground)]'}`}>
                      {notification.title}
                    </p>
                    <p className="text-[12px] text-[color:var(--muted-foreground)] line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="h-2 w-2 rounded-full bg-[color:var(--primary)] mt-1.5"></span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

