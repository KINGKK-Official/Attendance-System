import { useState, useEffect } from 'react';
import axios from 'axios';

const CourseManagement = () => {
  const [courses, setCourses]   = useState([]);
  const [faculty, setFaculty]   = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(null); // holds course being assigned
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [newCourse, setNewCourse] = useState({ name: '', code: '', faculty_id: '', semester: '', department: '', course_type: '3hr', schedule_days: '', time_slot: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [cRes, fRes] = await Promise.all([
        axios.get('/api/admin/courses'),
        axios.get('/api/admin/users'),
      ]);
      setCourses(cRes.data);
      setFaculty(fRes.data.filter(u => u.role === 'FACULTY'));
    } catch (err) {
      console.error('Failed to load data', err);
    }
  };

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await axios.post('/api/admin/courses', {
        name: newCourse.name,
        code: newCourse.code,
        semester: newCourse.semester,
        department: newCourse.department,
        course_type: newCourse.course_type,
        schedule_days: newCourse.schedule_days,
        time_slot: newCourse.time_slot,
        faculty_id: newCourse.faculty_id ? parseInt(newCourse.faculty_id) : null,
      });
      flash('Course created successfully!');
      setShowCreate(false);
      setNewCourse({ name: '', code: '', faculty_id: '', semester: '', department: '', course_type: '3hr', schedule_days: '', time_slot: '' });
      fetchAll();
    } catch (err) {
      let errMsg = 'Failed to create course';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      }
      flash(errMsg);
    }
  };

  async function handleAssign() {
    if (!selectedFacultyId) return;
    try {
      const res = await axios.post('/api/admin/assign-course', {
        course_id: showAssign.id,
        faculty_id: parseInt(selectedFacultyId),
      });
      flash(res.data.message);
      setShowAssign(null);
      setSelectedFacultyId('');
      fetchAll();
    } catch (err) {
      let errMsg = 'Assignment failed';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      }
      flash(errMsg);
    }
  };

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this course? This will remove all related sessions and attendance records.")) return;
    try {
      await axios.delete(`/api/admin/courses/${id}`);
      flash('Course deleted successfully!');
      fetchAll();
    } catch (err) {
      let errMsg = 'Failed to delete course';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      }
      flash(errMsg);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Course Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create courses and assign them to faculty members</p>
        </div>
        <button className="btn" onClick={() => setShowCreate(true)} style={{ padding: '12px 24px', backgroundColor: 'var(--iqra-blue)', color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + New Course
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', background: String(msg).toLowerCase().includes('fail') ? '#FEE2E2' : '#D1FAE5', color: String(msg).toLowerCase().includes('fail') ? '#991B1B' : '#065F46', fontWeight: 600 }}>
          {String(msg)}
        </div>
      )}

      {/* Courses Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {courses.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            No courses yet. Click "+ New Course" to add one.
          </div>
        ) : (
          courses.map(c => (
            <div key={c.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                  {c.course_type}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--iqra-gold)', marginBottom: '8px' }}>{c.code}</div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-main)', margin: '0 0 16px 0', lineHeight: 1.3 }}>{c.name}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', flex: 1 }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Department</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{c.department}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Semester</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{c.semester}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Schedule</div>
                  {c.schedule_days && c.time_slot ? (
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{c.schedule_days} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {c.time_slot}</span></div>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#EF4444' }}>Not set</div>
                  )}
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Assigned Faculty</div>
                {c.faculty_name === 'Unassigned' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444' }}>⚠ Unassigned</span>
                    <button className="btn" onClick={() => { setShowAssign(c); setSelectedFacultyId(c.faculty_id || ''); }} style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>Assign</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#10B981' }}>✓ {c.faculty_name}</span>
                    <button className="btn" onClick={() => { setShowAssign(c); setSelectedFacultyId(c.faculty_id || ''); }} style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>Change</button>
                  </div>
                )}
              </div>

              <button className="btn" onClick={() => handleDelete(c.id)} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                Delete Course
              </button>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', color: 'var(--iqra-blue)', margin: '0 0 24px 0' }}>New Course</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Course Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Artificial Intelligence"
                  value={newCourse.name}
                  onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Course Code</label>
                <input
                  className="input-field"
                  placeholder="e.g. CS-401"
                  value={newCourse.code}
                  onChange={e => setNewCourse({ ...newCourse, code: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Semester</label>
                  <input className="input-field" placeholder="e.g. Spring 26" value={newCourse.semester} onChange={e => setNewCourse({ ...newCourse, semester: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }} required />
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input className="input-field" placeholder="e.g. CS" value={newCourse.department} onChange={e => setNewCourse({ ...newCourse, department: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Course Type</label>
                  <select className="input-field" value={newCourse.course_type} onChange={e => setNewCourse({ ...newCourse, course_type: e.target.value, schedule_days: '', time_slot: '' })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }}>
                    <option value="3hr">3-Hour</option>
                    <option value="1.5hr">1.5-Hour</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Assign Faculty (optional)</label>
                  <select className="input-field" value={newCourse.faculty_id} onChange={e => setNewCourse({ ...newCourse, faculty_id: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }}>
                    <option value="">— Assign later —</option>
                    {faculty.map(f => <option key={f.id} value={f.id}>{f.full_name} ({f.email})</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <label style={labelStyle}>Schedule Days</label>
                  <select className="input-field" value={newCourse.schedule_days} onChange={e => setNewCourse({ ...newCourse, schedule_days: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }} required>
                    <option value="">— Select Days —</option>
                    {newCourse.course_type === '1.5hr' ? (
                      <>
                        <option value="MON/WED">MON / WED</option>
                        <option value="TUE/THU">TUE / THU</option>
                      </>
                    ) : (
                      <>
                        <option value="MON">Monday</option>
                        <option value="TUE">Tuesday</option>
                        <option value="WED">Wednesday</option>
                        <option value="THU">Thursday</option>
                        <option value="FRI">Friday</option>
                        <option value="SAT">Saturday</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Time Slot</label>
                  <select className="input-field" value={newCourse.time_slot} onChange={e => setNewCourse({ ...newCourse, time_slot: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white' }} required>
                    <option value="">— Select Time —</option>
                    {newCourse.course_type === '3hr' ? (
                      <>
                        <option value="08:30-11:20">08:30 - 11:20</option>
                        <option value="11:35-14:20">11:35 - 14:20</option>
                        <option value="14:30-17:20">14:30 - 17:20</option>
                      </>
                    ) : (
                      <>
                        <option value="08:30-09:40">08:30 - 09:40</option>
                        <option value="10:00-11:10">10:00 - 11:10</option>
                        <option value="11:35-12:45">11:35 - 12:45</option>
                        <option value="13:00-14:10">13:00 - 14:10</option>
                        <option value="14:30-15:40">14:30 - 15:40</option>
                        <option value="16:00-17:10">16:00 - 17:10</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowCreate(false)} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn" style={{ padding: '12px 32px', backgroundColor: 'var(--iqra-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Create Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssign && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
            <h2 style={{ fontSize: '24px', color: 'var(--iqra-blue)', margin: '0 0 16px 0' }}>Assign Faculty</h2>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Course</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{showAssign.name} <span style={{ color: 'var(--iqra-gold)', fontSize: '14px' }}>({showAssign.code})</span></div>
            </div>

            <label style={labelStyle}>Select Faculty Member</label>
            <select className="input-field" value={selectedFacultyId} onChange={e => setSelectedFacultyId(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white', marginBottom: '32px' }}>
              <option value="">— Select —</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.email})</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setShowAssign(null); setSelectedFacultyId(''); }} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="btn" onClick={handleAssign} disabled={!selectedFacultyId} style={{ padding: '12px 32px', backgroundColor: selectedFacultyId ? 'var(--iqra-blue)' : '#E2E8F0', color: selectedFacultyId ? 'white' : '#94A3B8', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: selectedFacultyId ? 'pointer' : 'not-allowed' }}>
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' };

export default CourseManagement;
