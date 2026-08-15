import { useState, useEffect } from 'react';
import api from '../api';

function DeanDashboard() {
  const [stats, setStats] = useState({ universityAttendance: 0, totalDepartments: 0, totalFaculty: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a full implementation, this would fetch from a specific DEAN endpoint
    // For MVP frontend demo, we mock the stats
    setStats({
      universityAttendance: 84.2,
      totalDepartments: 8,
      totalFaculty: 145
    });
    setLoading(false);
  }, []);

  if (loading) return <div style={{ padding: '40px' }}>Loading Dean Dashboard...</div>;

  return (
    <div className="page-container" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Dean Dashboard - University Overview</h2>
        <button className="btn btn-gold" onClick={() => window.print()}>Export University Report (PDF)</button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>University Attendance</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.universityAttendance}%</h2>
        </div>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>Active Departments</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.totalDepartments}</h2>
        </div>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>Total Faculty</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.totalFaculty}</h2>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: '16px' }}>Department Breakdown</h3>
        <table className="table-container">
          <thead>
            <tr>
              <th>Department</th>
              <th>Total Courses</th>
              <th>Total Students</th>
              <th>Avg Attendance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Computer Science (CS)</td>
              <td>42</td>
              <td>1200</td>
              <td>85%</td>
              <td><span style={{ color: 'green' }}>Good</span></td>
            </tr>
            <tr>
              <td>Software Engineering (SE)</td>
              <td>38</td>
              <td>1050</td>
              <td>82%</td>
              <td><span style={{ color: 'green' }}>Good</span></td>
            </tr>
            <tr>
              <td>Artificial Intelligence (AI)</td>
              <td>24</td>
              <td>800</td>
              <td>72%</td>
              <td><span style={{ color: 'red' }}>Needs Attention</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DeanDashboard;
