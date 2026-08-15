import { useState, useEffect } from 'react';
import axios from 'axios';

const AcademicEnrollment = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [eRes, sRes, cRes] = await Promise.all([
        axios.get('/api/admin/enrollments'),
        axios.get('/api/admin/students'),
        axios.get('/api/admin/courses')
      ]);
      setEnrollments(eRes.data);
      setStudents(sRes.data);
      setCourses(cRes.data);
    } catch (err) {
      console.error("Failed to fetch data");
    }
  };

  async function handleEnroll(e) {
    e.preventDefault();
    if (!selectedStudent || !selectedCourse) return;

    try {
      const res = await axios.post('/api/admin/enroll-academic', {
        student_id: selectedStudent,
        course_id: parseInt(selectedCourse)
      });
      setMsg(res.data.message);
      fetchData();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg("Enrollment failed");
      setTimeout(() => setMsg(''), 3000);
    }
  };

  async function enrollAllInAll() {
    if (!window.confirm("Are you sure you want to enroll ALL students in ALL courses?")) return;
    setMsg("Processing bulk enrollment...");
    try {
      for (const student of students) {
        for (const course of courses) {
          await axios.post('/api/admin/enroll-academic', {
            student_id: student.id,
            course_id: course.id
          });
        }
      }
      setMsg("Bulk enrollment completed successfully!");
      fetchData();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg("Bulk enrollment encountered errors");
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Academic Enrollment</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage student course registrations</p>
        </div>
        <button className="btn" onClick={enrollAllInAll} style={{ padding: '12px 24px', backgroundColor: '#10B981', color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          Enroll All in All Courses
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', background: String(msg).toLowerCase().includes('fail') || String(msg).toLowerCase().includes('error') ? '#FEE2E2' : '#D1FAE5', color: String(msg).toLowerCase().includes('fail') || String(msg).toLowerCase().includes('error') ? '#991B1B' : '#065F46', fontWeight: 600 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        {/* Quick Enrollment Form */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '24px' }}>Quick Enrollment</h3>
          <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>Student</label>
              <select 
                className="input-field" 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }}
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                required
              >
                <option value="">Select Student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.id})</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>Course</label>
              <select 
                className="input-field" 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }}
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                required
              >
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            <button type="submit" className="btn" style={{ marginTop: '8px', padding: '12px', backgroundColor: 'var(--iqra-blue)', color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Enroll Student
            </button>
          </form>
        </div>

        {/* Enrollments Table */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '24px' }}>Current Academic Enrollments</h3>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', position: 'sticky', top: 0, backgroundColor: 'white' }}>Student ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', position: 'sticky', top: 0, backgroundColor: 'white' }}>Student Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', position: 'sticky', top: 0, backgroundColor: 'white' }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', position: 'sticky', top: 0, backgroundColor: 'white' }}>Course Name</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e, index) => (
                  <tr key={index} style={{ borderBottom: index !== enrollments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '16px' }}><code style={{ backgroundColor: 'var(--bg-main)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '13px' }}>{e.student_id}</code></td>
                    <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{e.student_name}</td>
                    <td style={{ padding: '16px' }}><code style={{ backgroundColor: '#FEF3C7', padding: '4px 8px', borderRadius: '4px', color: '#92400E', fontSize: '13px', fontWeight: 600 }}>{e.course_code}</code></td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{e.course_name}</td>
                  </tr>
                ))}
                {enrollments.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No academic enrollments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicEnrollment;
