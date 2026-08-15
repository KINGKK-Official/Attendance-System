import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function HodDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, overallAttendance: 0 });
  const [alertCourses, setAlertCourses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a full implementation, this would fetch from a specific HOD endpoint
    // For MVP frontend demo, we fetch all courses and filter, or just display mock data if API is missing
    async function fetchData() {
      try {
        const response = await api.get('/api/admin/courses');
        const deptCourses = response.data; // Ideally filtered by backend
        
        setStats({
          totalCourses: deptCourses.length,
          totalStudents: deptCourses.length * 40, // mock calculation
          overallAttendance: 82.5 // mock
        });
        
        setCourses(deptCourses);
        setAlertCourses(deptCourses.slice(0, 2)); // mock alerts
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '40px' }}>Loading HOD Dashboard...</div>;

  return (
    <div className="page-container" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>
          {user?.role === 'ASSOCIATE_DEAN' ? 'Associate Dean Dashboard - University Overview' : 'HOD Dashboard - Department Overview'}
        </h2>
        <button className="btn btn-gold" onClick={() => window.print()}>Export Department Report (PDF)</button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>Total Courses</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.totalCourses}</h2>
        </div>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>Enrolled Students</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.totalStudents}</h2>
        </div>
        <div className="glass-card">
          <h4 style={{ color: '#64748b' }}>Overall Attendance</h4>
          <h2 style={{ fontSize: '32px', color: 'var(--iqra-gold)' }}>{stats.overallAttendance}%</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="glass-card">
          <h3 style={{ marginBottom: '16px' }}>
            {user?.role === 'ASSOCIATE_DEAN' ? 'All Courses' : 'Department Courses'}
          </h3>
          <table className="table-container">
            <thead>
              <tr>
                <th>Code</th>
                <th>Course Name</th>
                <th>Faculty</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.faculty_name}</td>
                  <td>-</td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No courses found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="glass-card" style={{ borderTop: '4px solid #ef4444' }}>
          <h3 style={{ marginBottom: '16px', color: '#ef4444' }}>Needs Attention</h3>
          {alertCourses.map(c => (
             <div key={c.id} style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', marginBottom: '12px' }}>
                <strong>{c.code}</strong> - {c.name}
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Attendance below 75%</div>
             </div>
          ))}
          {alertCourses.length === 0 && <p>No alerts at this time.</p>}
        </div>
      </div>
    </div>
  );
}

export default HodDashboard;
