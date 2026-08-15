import { useState, useEffect } from 'react';
import api from '../../api';

const AuditView = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAudit(); }, []);

  async function fetchAudit() {
    setLoading(true);
    try {
      const res = await api.get('/api/student/audit');
      setRows(res.data || []);
    } catch (err) {
      console.error('Failed to load audit trail', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--iqra-blue)' }}>Attendance Changes</h1>
        <p style={{ color: '#64748B' }}>
          A transparent, read-only record of every manual change made to your attendance.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '32px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            No manual changes have been made to your attendance records.
          </p>
        ) : (
          <table className="table-container">
            <thead>
              <tr>
                <th>Date</th>
                <th style={{ textAlign: 'center' }}>Session</th>
                <th>Changed by</th>
                <th style={{ textAlign: 'center' }}>From</th>
                <th style={{ textAlign: 'center' }}>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <code style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontSize: '13px' }}>
                      #{r.session_id ?? '—'}
                    </code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.actor_name}</td>
                  <td style={{ textAlign: 'center', color: '#991B1B' }}>{r.old_value || '—'}</td>
                  <td style={{ textAlign: 'center', color: '#166534', fontWeight: 700 }}>{r.new_value || '—'}</td>
                  <td style={{ color: '#475569' }}>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditView;
