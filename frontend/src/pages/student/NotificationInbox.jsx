import { useState, useEffect } from 'react';
import api from '../../api';

const LEVEL_STYLES = {
  warning:  { bg: '#FFFBEB', color: '#92400E', dot: '#D97706', label: 'Warning' },
  critical: { bg: '#FEF2F2', color: '#991B1B', dot: '#DC2626', label: 'Critical' },
};

const NotificationInbox = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await api.get('/api/student/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  async function markRead() {
    try {
      await api.post(`/api/student/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="main-content">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--iqra-blue)' }}>
          Notifications {unreadCount > 0 && (
            <span style={{
              fontSize: '14px', verticalAlign: 'middle', marginLeft: '10px',
              background: 'var(--iqra-red)', color: 'white', padding: '4px 10px', borderRadius: '20px',
            }}>{unreadCount} new</span>
          )}
        </h1>
        <p style={{ color: '#64748B' }}>Attendance alerts and reminders.</p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          You have no notifications.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(n => {
            const s = LEVEL_STYLES[n.level] || LEVEL_STYLES.warning;
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className="glass-card"
                style={{
                  padding: '18px 22px', cursor: n.read ? 'default' : 'pointer',
                  borderLeft: `5px solid ${s.dot}`, opacity: n.read ? 0.7 : 1,
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                }}
              >
                <span style={{
                  marginTop: '6px', width: '10px', height: '10px', borderRadius: '50%',
                  background: n.read ? '#CBD5E1' : s.dot, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: '12px', background: s.bg, color: s.color,
                    }}>{s.label}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: n.read ? 400 : 600 }}>
                    {n.message}
                  </p>
                </div>
                {!n.read && (
                  <span style={{ fontSize: '12px', color: 'var(--iqra-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Mark read
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationInbox;
