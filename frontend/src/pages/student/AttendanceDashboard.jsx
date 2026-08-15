import { useState, useEffect } from 'react';
import api from '../../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const STATUS_STYLES = {
  safe:     { label: 'Safe',     bg: '#F0FDF4', color: '#166534', bar: '#16A34A' },
  warning:  { label: 'Warning',  bg: '#FFFBEB', color: '#92400E', bar: '#D97706' },
  critical: { label: 'Critical', bg: '#FEF2F2', color: '#991B1B', bar: '#DC2626' },
};

const barColor = (pct) => (pct >= 80 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626');

const AttendanceDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchDashboard(); }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res = await api.get('/api/student/dashboard');
      const list = res.data.courses || [];
      setCourses(list);
      if (list.length > 0) setSelected(list[0].course_id);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourse = courses.find(c => c.course_id === selected);

  return (
    <div className="main-content">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--iqra-blue)' }}>My Attendance</h1>
        <p style={{ color: '#64748B' }}>Track your attendance across all enrolled courses.</p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>Loading your attendance…</p>
      ) : courses.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          You are not enrolled in any courses yet.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {courses.map(c => {
              const s = STATUS_STYLES[c.status] || STATUS_STYLES.safe;
              const isActive = c.course_id === selected;
              return (
                <div
                  key={c.course_id}
                  className="glass-card"
                  onClick={() => setSelected(c.course_id)}
                  style={{
                    padding: '24px', cursor: 'pointer',
                    borderLeft: `6px solid ${s.bar}`,
                    outline: isActive ? '2px solid var(--iqra-blue)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>{c.course_code}</div>
                      <h3 style={{ margin: '4px 0 0', fontSize: '17px' }}>{c.course_name}</h3>
                    </div>
                    <span style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
                      fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap',
                    }}>{s.label}</span>
                  </div>
                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 800, color: s.bar }}>{c.percentage}%</span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      {c.sessions_attended}/{c.sessions_held} sessions
                    </span>
                  </div>
                  {c.at_risk && (
                    <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>
                      ⚠ Flagged as at-risk
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weekly chart for selected course */}
          {selectedCourse && (
            <div className="glass-card" style={{ padding: '32px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Weekly Attendance — {selectedCourse.course_name}</h3>
              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px', marginBottom: '24px' }}>
                Attendance percentage per week. Green ≥ 80%, amber 75–79%, red &lt; 75%.
              </p>
              {selectedCourse.weekly.length === 0 ? (
                <p style={{ color: '#64748B', padding: '40px', textAlign: 'center' }}>No conducted sessions yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={selectedCourse.weekly} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} stroke="#64748B" fontSize={12} />
                    <YAxis domain={[0, 100]} unit="%" stroke="#64748B" fontSize={12} />
                    <Tooltip
                      formatter={(v, n, p) => [`${v}% (${p.payload.attended}/${p.payload.held})`, 'Attendance']}
                      labelFormatter={(w) => `Week ${w}`}
                    />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                      {selectedCourse.weekly.map((d, i) => (
                        <Cell key={i} fill={barColor(d.percentage)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceDashboard;
