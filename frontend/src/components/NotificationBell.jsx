import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, LoaderCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await api.get('/notifications');
      setItems((result.notifications || []).filter((item) => item.channel === 'IN_APP'));
      setUnreadCount(result.unread_count || 0);
      setError('');
    } catch (requestError) {
      setError(requestError.message || t('notifications.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return undefined;
    }
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh, user?.id]);

  const markRead = async (item) => {
    if (item.is_read) return;
    try {
      await api.patch(`/notifications/${item.id}/read`, {});
      setItems((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, is_read: true, status: 'READ' } : entry
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(requestError.message || t('notifications.loadFailed'));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', {});
      setItems((current) => current.map((item) => ({ ...item, is_read: true, status: 'READ' })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.message || t('notifications.loadFailed'));
    }
  };

  if (!user) return null;

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-bell"
        aria-label={`${t('notifications.title')}${unreadCount ? `, ${t('notifications.unread', { count: unreadCount })}` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) refresh();
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-popover" role="dialog" aria-label={t('notifications.title')}>
          <div className="notification-popover-heading">
            <div>
              <strong>{t('notifications.title')}</strong>
              <span>{t('notifications.unread', { count: unreadCount })}</span>
            </div>
            <button type="button" onClick={markAllRead} disabled={!unreadCount} aria-label={t('notifications.markAllRead')} title={t('notifications.markAllRead')}>
              <CheckCheck size={17} />
            </button>
          </div>
          {error && <p className="notification-error" role="alert">{error}</p>}
          {loading && items.length === 0 ? (
            <div className="notification-empty"><LoaderCircle className="spin" size={18} /> {t('notifications.loading')}</div>
          ) : items.length === 0 ? (
            <p className="notification-empty">{t('notifications.empty')}</p>
          ) : (
            <div className="notification-list">
              {items.map((item) => (
                <button
                  type="button"
                  className={`notification-item ${item.is_read ? 'is-read' : 'is-unread'}`}
                  key={item.id}
                  onClick={() => markRead(item)}
                  aria-label={`${item.title}. ${item.is_read ? '' : t('notifications.markRead')}`}
                >
                  <span className="notification-item-dot" />
                  <span>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
