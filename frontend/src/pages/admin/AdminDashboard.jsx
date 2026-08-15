import { useState, useEffect } from 'react';
import api from '../../api';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [ov, sec] = await Promise.all([
        api.get('/api/admin/analytics/overview'),
        api.get('/api/admin/analytics/security')
      ]);
      setData(ov.data);
      setSecurity(sec.data);
    } catch (e) {
      console.error('analytics load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading || !data) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>Loading Analytics Data...</div>;
  }

  const kpis = data.kpis || {};
  const departments = security ? security.departments || [] : [];
  
  // Mock data for Risk List and Faculty Compliance as the current API doesn't return detailed lists for these
  const mockRiskList = [
    { name: 'Ali Khan', course: 'CS-401', attendance: 62 },
    { name: 'Zainab Ahmed', course: 'SE-302', attendance: 58 },
    { name: 'Omar Farooq', course: 'EE-201', attendance: 65 },
    { name: 'Fatima Bilal', course: 'CS-401', attendance: 70 },
  ];

  const mockFacultyCompliance = [
    { name: 'Dr. Sarah Ahmed', scheduled: 24, completed: 24, compliance: 100 },
    { name: 'Dr. Bilal Khan', scheduled: 16, completed: 14, compliance: 87.5 },
    { name: 'Prof. Sana Syed', scheduled: 12, completed: 11, compliance: 91.6 },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Department Reports</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Comprehensive overview of institutional performance and compliance</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" style={{ padding: '12px 24px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
            Filter by Semester
          </button>
          <button className="btn" style={{ padding: '12px 24px', backgroundColor: 'var(--iqra-gold)', borderRadius: '8px', border: 'none', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
            Unified Audit Log
          </button>
          <button className="btn" style={{ padding: '12px 24px', backgroundColor: 'var(--iqra-gold)', borderRadius: '8px', border: 'none', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
            Granular Permissions
          </button>
          <button className="btn" style={{ padding: '12px 24px', backgroundColor: 'var(--iqra-blue)', borderRadius: '8px', border: 'none', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid #10B981' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Avg Attendance</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.overall_attendance?.toFixed(1)}%</span>
            <span style={{ color: '#10B981', fontSize: '14px', fontWeight: 600 }}>▲ +1.2%</span>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid var(--iqra-gold)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Classes Conducted</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.sessions_conducted}</div>
        </div>
        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid #EF4444' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>At Risk Students</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{kpis.at_risk_students}</div>
        </div>
        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid #8B5CF6' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>System Alerts</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{data.security?.spoof_alerts || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Department-wise Comparison */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '24px' }}>Department-wise Comparison</h3>
          
          {departments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No department data available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {departments.map(d => (
                <div key={d.department}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                    <span>{d.department}</span>
                    <span>{d.percentage}%</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'var(--bg-main)', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${d.percentage}%`, 
                      backgroundColor: d.percentage >= 80 ? '#10B981' : d.percentage >= 70 ? 'var(--iqra-gold)' : '#EF4444',
                      height: '100%',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk List */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '24px' }}>Risk List</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mockRiskList.map((student, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: idx !== mockRiskList.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{student.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{student.course}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#EF4444' }}>
                  {student.attendance}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Faculty Compliance */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '24px' }}>Faculty Compliance & Utilization</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Faculty Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Sessions Scheduled</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Sessions Completed</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Compliance %</th>
            </tr>
          </thead>
          <tbody>
            {mockFacultyCompliance.map((f, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{f.name}</td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{f.scheduled}</td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{f.completed}</td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    padding: '6px 12px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    backgroundColor: f.compliance >= 95 ? '#D1FAE5' : '#FEF3C7',
                    color: f.compliance >= 95 ? '#065F46' : '#92400E'
                  }}>
                    {f.compliance}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};

export default AdminDashboard;
