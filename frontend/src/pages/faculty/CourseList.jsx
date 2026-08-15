import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [week, setWeek] = useState(1);
  const [sessionOfWeek, setSessionOfWeek] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    try {
      const response = await axios.get('/api/faculty/courses');
      setCourses(response.data);
    } catch (err) {
      console.error("Failed to fetch courses");
    }
  };

  async function handleStartAttendance(e) {
    e.preventDefault();
    if (!selectedCourse) return;

    // Calculate overall session number
    const sessionNum = selectedCourse.course_type === '1.5hr'
      ? (parseInt(week) - 1) * 2 + parseInt(sessionOfWeek)
      : parseInt(week);

    try {
      const response = await axios.post('/api/faculty/sessions/start', {
        course_id: selectedCourse.id,
        room_id: 1, // Mock room for MVP
        week_number: parseInt(week),
        session_number: sessionNum
      });
      setShowModal(false);
      navigate(`/faculty/sessions/${response.data.session_id}`);
    } catch (err) {
      alert("Failed to start session");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCourse(null);
    setWeek(1);
    setSessionOfWeek(1);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Daily Schedule</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>View your classes for today and manage attendance</p>
        </div>
        <div style={{ padding: '12px 24px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', fontWeight: 600, color: 'var(--text-main)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '24px' }}>Today's Classes</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {courses.map((course, index) => (
          <div key={course.id} className="glass-card" style={{ 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            borderLeft: '4px solid var(--iqra-blue)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--iqra-blue)' }}>{index === 0 ? '09:00 AM' : '02:00 PM'}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{index === 0 ? '12:00 PM' : '05:00 PM'}</span>
              </div>
              
              <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border)' }}></div>

              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{course.name}</h3>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '14px', alignItems: 'center' }}>
                  <span><span style={{ marginRight: '6px' }}>🏷️</span> {course.code}</span>
                  <span><span style={{ marginRight: '6px' }}>📍</span> Lab {index + 1}</span>
                  <span><span style={{ marginRight: '6px' }}>👥</span> 45 Students Enrolled</span>
                </div>
              </div>
            </div>
            
            <button 
              className="btn" 
              style={{ 
                backgroundColor: 'var(--iqra-blue)', 
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
              onClick={() => { setSelectedCourse(course); setShowModal(true); }}
            >
              Start Attendance
            </button>
          </div>
        ))}
        
        {courses.length === 0 && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>No classes today!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', margin: 0 }}>You don't have any classes scheduled for today.</p>
          </div>
        )}
      </div>

      {showModal && selectedCourse && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginBottom: '8px', color: 'var(--text-main)' }}>Start Live Scan</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Course: <strong>{selectedCourse.name}</strong> ({selectedCourse.code})
            </p>

            <form onSubmit={handleStartAttendance}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Select Week</label>
                <select 
                  className="input-field" 
                  value={week} 
                  onChange={(e) => setWeek(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>

              {selectedCourse.course_type === '1.5hr' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={labelStyle}>Select Session of the Week</label>
                  <select 
                    className="input-field" 
                    value={sessionOfWeek} 
                    onChange={(e) => setSessionOfWeek(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}
                  >
                    <option value="1">Session 1 (e.g. Mon/Tue)</option>
                    <option value="2">Session 2 (e.g. Wed/Thu)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn" style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn" style={{ flex: 1, backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue-dark)', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Start AI Monitoring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' };

export default CourseList;
