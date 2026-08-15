import { useState, useEffect } from 'react';
import api from '../../api';

const HODDashboard = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock load
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>Loading Department Data...</div>;
  }

  const mockCourses = [
    { code: 'CS-401', name: 'Software Engineering', enrollment: 55, attendance: 82.5 },
    { code: 'SE-302', name: 'Web Architecture', enrollment: 40, attendance: 78.0 },
  ];

  const mockAuditLogs = [
    { time: '2026-07-09 10:15', actor: 'Dr. Sarah', action: 'manual_override', details: 'Hit 1 resolved (Student Present)' },
    { time: '2026-07-08 14:20', actor: 'System', action: 'tier2_resolution', details: 'Hit 2 resolved via AdaFace' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: 'var(--iqra-blue)' }}>HOD Portal</h1>
      <p style={{ color: 'var(--text-muted)' }}>Scoped view for assigned department</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3>Department Courses</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {mockCourses.map((c, i) => (
              <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <strong>{c.code}</strong> - {c.name} 
                <span style={{ float: 'right', color: c.attendance < 80 ? 'red' : 'green' }}>{c.attendance}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <h3>Department Audit Logs</h3>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px' }}>
            {mockAuditLogs.map((log, i) => (
              <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span style={{ color: 'gray' }}>{log.time}</span> | <strong>{log.actor}</strong> | {log.action}
                <br/>
                <span style={{ color: '#555' }}>{log.details}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HODDashboard;
