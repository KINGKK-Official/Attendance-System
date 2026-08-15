import { useState, useEffect } from 'react';
import api from '../../api';

const Reports = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchReport();
    }
  }, [selectedCourse]);

  async function fetchCourses() {
    try {
      const response = await api.get('/api/faculty/courses');
      setCourses(response.data);
    } catch (err) {
      console.error("Failed to fetch courses");
    }
  };

  async function fetchReport() {
    setLoading(true);
    try {
      const response = await api.get(`/api/faculty/courses/${selectedCourse}/cumulative`);
      setReportData(response.data);
    } catch (err) {
      console.error("Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = ["Student ID", "Full Name", "Total Sessions", "Present Count", "Percentage", "Status"];
    const rows = reportData.map(r => [
      r.student_id,
      r.full_name,
      r.total_sessions,
      r.present_count,
      r.percentage,
      r.alert
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const courseName = courses.find(c => c.id === selectedCourse)?.name || 'course';
    link.setAttribute("download", `attendance_report_${courseName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function handleExportPDF() {
    if (!selectedCourse) return;
    try {
      const response = await api.get(`/api/faculty/courses/${selectedCourse}/export-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const courseName = courses.find(c => c.id === selectedCourse)?.name || 'course';
      link.setAttribute('download', `attendance_report_${courseName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("Failed to generate PDF report");
    }
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--iqra-blue)' }}>Attendance Reports</h1>
        <p style={{ color: '#64748B' }}>Analyze and export cumulative academic attendance records.</p>
      </div>

      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Select a Course</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {courses.map(c => (
            <button 
              key={c.id} 
              className={`btn ${selectedCourse === c.id ? 'btn-primary' : ''}`}
              style={{ 
                background: selectedCourse === c.id ? 'var(--iqra-blue)' : 'white',
                color: selectedCourse === c.id ? 'white' : 'var(--iqra-blue)',
                border: '1px solid var(--iqra-blue)',
                padding: '10px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onClick={() => setSelectedCourse(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Academic Performance Report</h3>
              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
                Course: <strong>{courses.find(c => c.id === selectedCourse)?.name}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn" 
                style={{ background: '#E2E8F0', color: 'var(--iqra-blue)' }}
                onClick={handleExportCSV}
                disabled={reportData.length === 0}
              >
                Export CSV
              </button>
              <button 
                className="btn btn-gold" 
                onClick={handleExportPDF}
                disabled={reportData.length === 0}
              >
                Export PDF Report
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>📊 Loading attendance metrics...</p>
          ) : reportData.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>No attendance data found for this course.</p>
          ) : (
            <table className="table-container">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th style={{ textAlign: 'center' }}>Total Sessions</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Attendance %</th>
                  <th style={{ textAlign: 'right' }}>Status Alert</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map(r => (
                  <tr key={r.student_id}>
                    <td><code style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontSize: '13px' }}>{r.student_id}</code></td>
                    <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                    <td style={{ textAlign: 'center' }}>{r.total_sessions}</td>
                    <td style={{ textAlign: 'center' }}>{r.present_count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.percentage}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: 700,
                        background: r.alert === 'Good' ? '#F0FDF4' : '#FEF2F2',
                        color: r.alert === 'Good' ? '#166534' : '#991B1B'
                      }}>
                        {r.alert}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
