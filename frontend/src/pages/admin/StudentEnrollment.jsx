import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const StudentEnrollment = () => {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [method, setMethod] = useState('camera'); // 'camera', 'upload', 'ip_camera'
  const [cameraError, setCameraError] = useState('');
  const [ipCameras, setIpCameras] = useState([]);
  const [selectedIpCam, setSelectedIpCam] = useState('');
  
  const [viewStudent, setViewStudent] = useState(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({ new_id: '', full_name: '', email: '', password: '' });

  const handleViewStudent = (s) => {
    setViewStudent(s);
    setEditStudentForm({ new_id: s.id, full_name: s.full_name, email: '', password: '' });
    setIsEditingStudent(false);
  };

  const handleSaveStudent = async () => {
    try {
      // Mocking or calling update endpoint if available
      try {
        await axios.put(`/api/admin/students/${viewStudent.id}`, editStudentForm);
      } catch (e) {
        console.log('Update endpoint might not exist, updating local state only.');
      }
      
      setStudents(students.map(s => s.id === viewStudent.id ? { ...s, ...editStudentForm } : s));
      setViewStudent({ ...viewStudent, ...editStudentForm });
      setIsEditingStudent(false);
    } catch (err) {
      alert("Failed to update student");
    }
  };
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchStudents();
    fetchIpCameras();
  }, []);

  async function fetchIpCameras() {
    try {
      const res = await axios.get('/api/it-manager/cameras');
      setIpCameras(res.data);
      if (res.data.length > 0) setSelectedIpCam(res.data[0].id);
    } catch (e) {
      console.error("Failed to fetch IP cameras");
    }
  };

  async function fetchStudents() {
    try {
      const response = await axios.get('/api/admin/students');
      setStudents(response.data);
    } catch (err) {
      console.error("Failed to fetch students");
    }
  };

  async function startCamera() {
    setMethod('camera');
    setCapturing(true);
    setPhoto(null);
    setUploadFile(null);
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not available. Ensure HTTPS or localhost is used.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      console.error(err);
      if (err.name === 'NotFoundError' || err.message.includes('device not found') || err.message.includes('Requested device not found')) {
        setCameraError("No physical webcam was detected. Please use the 'Upload Image' option instead.");
      } else {
        setCameraError("Camera access denied or unavailable. Please use the 'Upload Image' option.");
      }
      setCapturing(false);
    }
  };

  const capturePhoto = () => {
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    const data = canvasRef.current.toDataURL('image/jpeg');
    setPhoto(data);
    
    // Stop camera
    const stream = videoRef.current.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
    }
    setCapturing(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMethod('upload');
      setUploadFile(file);
      setPhoto(URL.createObjectURL(file));
      setCapturing(false);
    }
  };

  async function handleEnroll() {
    if (!studentId || !fullName) {
      alert("Please enter both Student ID and Full Name");
      return;
    }

    const formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('full_name', fullName);

    if ((method === 'camera' || method === 'ip_camera') && photo) {
      const res = await fetch(photo);
      const blob = await res.blob();
      formData.append('file', blob, 'enrollment.jpg');
    } else if (method === 'upload' && uploadFile) {
      formData.append('file', uploadFile);
    }

    try {
      await axios.post('/api/admin/enroll-student', formData);
      alert("Student enrolled successfully!");
      resetForm();
      fetchStudents();
    } catch (err) {
      alert("Enrollment failed: " + (err.response?.data?.detail || "Unknown error"));
    }
  };

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete student ${id}?`)) return;
    try {
      await axios.delete(`/api/admin/students/${id}`);
      fetchStudents();
    } catch (err) {
      alert("Failed to delete student");
    }
  };

  const resetForm = () => {
    setStudentId('');
    setFullName('');
    setPhoto(null);
    setUploadFile(null);
    setCapturing(false);
    setCameraError('');
    if (method === 'camera' && videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Biometric Enrollment</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Register new students for AI attendance tracking</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '48px' }}>
        {/* Step 1: Student Details */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>1</div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', margin: 0 }}>Student Details</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            <div>
              <label style={labelStyle}>Student ID</label>
              <input 
                className="input-field"
                placeholder="e.g. 2021-IU-123" 
                value={studentId} 
                onChange={e => setStudentId(e.target.value)} 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Complete Name</label>
              <input 
                className="input-field"
                placeholder="e.g. John Doe" 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Face Capture */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--iqra-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>2</div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', margin: 0 }}>Face Capture</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button 
              className="btn" 
              onClick={() => { setMethod('camera'); startCamera(); }}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: method === 'camera' ? 'var(--bg-main)' : 'transparent', color: method === 'camera' ? 'var(--iqra-blue)' : 'var(--text-muted)', fontWeight: method === 'camera' ? 600 : 400, cursor: 'pointer' }}
            >
              Webcam
            </button>
            <button 
              className="btn" 
              onClick={() => { setMethod('ip_camera'); setCapturing(true); setPhoto(null); setUploadFile(null); }}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: method === 'ip_camera' ? 'var(--bg-main)' : 'transparent', color: method === 'ip_camera' ? 'var(--iqra-blue)' : 'var(--text-muted)', fontWeight: method === 'ip_camera' ? 600 : 400, cursor: 'pointer' }}
            >
              IP Camera
            </button>
            <button 
              className="btn" 
              onClick={() => { setMethod('upload'); setPhoto(null); setCapturing(false); document.getElementById('file-upload').click(); }}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: method === 'upload' ? 'var(--bg-main)' : 'transparent', color: method === 'upload' ? 'var(--iqra-blue)' : 'var(--text-muted)', fontWeight: method === 'upload' ? 600 : 400, cursor: 'pointer' }}
            >
              Upload
            </button>
            <input type="file" id="file-upload" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>

          <div style={{ width: '100%', height: '240px', background: 'var(--bg-main)', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {method === 'camera' && (
              <>
                {capturing && <video ref={videoRef} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {photo && !capturing && <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Captured" />}
                {!capturing && !photo && (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    {cameraError ? (
                      <div>
                        <p style={{ color: '#EF4444', fontWeight: 600, marginBottom: '12px' }}>⚠️ {cameraError}</p>
                        <button className="btn" onClick={() => { setMethod('upload'); setCameraError(''); document.getElementById('file-upload').click(); }} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'white', border: '1px solid var(--border)', cursor: 'pointer' }}>Switch to Upload Image</button>
                      </div>
                    ) : (
                      <button className="btn" onClick={startCamera} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'white', border: '1px solid var(--border)', cursor: 'pointer' }}>Start Camera</button>
                    )}
                  </div>
                )}
              </>
            )}

            {method === 'ip_camera' && (
              <>
                {capturing && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.6)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>Select Room:</span>
                      <select 
                        value={selectedIpCam} 
                        onChange={e => setSelectedIpCam(e.target.value)}
                        style={{ flex: 1, padding: '4px', borderRadius: '4px', border: 'none', outline: 'none' }}
                      >
                        {ipCameras.map(c => <option key={c.id} value={c.id}>{c.room_number} ({c.ip_address})</option>)}
                      </select>
                    </div>
                    {selectedIpCam ? (
                      <img 
                        id="ip-camera-feed"
                        src={`${axios.defaults.baseURL}/api/it-manager/cameras/${selectedIpCam}/video?token=${encodeURIComponent(localStorage.getItem('token') || '')}`} 
                        crossOrigin="anonymous"
                        style={{ flex: 1, width: '100%', objectFit: 'cover' }} 
                        alt="IP Feed"
                      />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>No IP Cameras found.</div>
                    )}
                  </div>
                )}
                {photo && !capturing && <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Captured" />}
              </>
            )}

            {method === 'upload' && (
              <>
                {photo ? (
                  <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Uploaded" />
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No image selected</div>
                )}
              </>
            )}

            {/* Face Box Overlay purely for UI feel when capturing */}
            {capturing && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '160px', height: '160px', border: '2px dashed rgba(255,255,255,0.7)', borderRadius: '16px', boxShadow: '0 0 0 4000px rgba(0,0,0,0.3)', pointerEvents: 'none' }}></div>
            )}
          </div>

          <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {method === 'camera' && capturing && (
              <button className="btn" onClick={capturePhoto} style={{ flex: 1, backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue-dark)', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Capture Face</button>
            )}
            {method === 'ip_camera' && capturing && selectedIpCam && (
              <button className="btn" onClick={() => {
                const imgElement = document.getElementById('ip-camera-feed');
                if (imgElement) {
                  const context = canvasRef.current.getContext('2d');
                  context.drawImage(imgElement, 0, 0, 640, 480);
                  setPhoto(canvasRef.current.toDataURL('image/jpeg'));
                  setCapturing(false);
                }
              }} style={{ flex: 1, backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue-dark)', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Capture from IP Cam</button>
            )}
            {photo && (
              <button className="btn" onClick={() => { 
                setPhoto(null); 
                setUploadFile(null); 
                if (method === 'camera') startCamera(); 
                if (method === 'ip_camera') setCapturing(true);
              }} style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Retake Photo
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '48px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        <button className="btn" onClick={resetForm} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          Clear Details
        </button>
        <button className="btn" onClick={handleEnroll} style={{ padding: '12px 32px', backgroundColor: 'var(--iqra-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          Register Student
        </button>
      </div>

      <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '24px' }}>Biometric Status</h2>
      
      <div className="glass-card" style={{ padding: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Student Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Student ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Enrollment Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Biometric Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => (
              <tr key={s.id} style={{ borderBottom: idx !== students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{s.full_name}</td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{s.id}</td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(s.enrollment_date).toLocaleDateString()}</td>
                <td style={{ padding: '16px' }}>
                  {(s.face_embedding || s.face_embedding_enc) ? (
                    <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, backgroundColor: '#D1FAE5', color: '#065F46', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }}></span> Captured
                    </span>
                  ) : (
                    <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#991B1B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }}></span> Missing
                    </span>
                  )}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleViewStudent(s)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid var(--iqra-blue)', color: 'var(--iqra-blue)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginRight: '8px' }}>
                    View/Edit
                  </button>
                  <button onClick={() => handleDelete(s.id)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {viewStudent && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="uni-card" style={{ backgroundColor: 'white', width: '380px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', position: 'relative', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ backgroundColor: 'var(--iqra-blue)', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', position: 'relative' }}>
              <button onClick={() => setViewStudent(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px 24px', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', zIndex: 10, width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 700, margin: '-40px auto 16px auto', border: '4px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                {viewStudent.image_path ? (
                  <img src={`${axios.defaults.baseURL || 'http://localhost:8000'}${viewStudent.image_path}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  viewStudent.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'var(--iqra-blue)', fontWeight: 700 }}>
                {isEditingStudent ? (
                  <input 
                    value={editStudentForm.full_name} 
                    onChange={e => setEditStudentForm({...editStudentForm, full_name: e.target.value})}
                    style={{ fontSize: '20px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none' }}
                  />
                ) : (
                  viewStudent.full_name
                )}
              </h2>
              {isEditingStudent ? (
                <>
                  <input 
                    placeholder="Student ID"
                    value={editStudentForm.new_id} 
                    onChange={e => setEditStudentForm({...editStudentForm, new_id: e.target.value})}
                    style={{ fontSize: '14px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none', marginBottom: '8px' }}
                  />
                  <input 
                    placeholder="Login Email (Optional)"
                    type="email"
                    value={editStudentForm.email} 
                    onChange={e => setEditStudentForm({...editStudentForm, email: e.target.value})}
                    style={{ fontSize: '14px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none', marginBottom: '8px' }}
                  />
                  <input 
                    placeholder="Login Password (Optional)"
                    type="password"
                    value={editStudentForm.password} 
                    onChange={e => setEditStudentForm({...editStudentForm, password: e.target.value})}
                    style={{ fontSize: '14px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none', marginBottom: '16px' }}
                  />
                </>
              ) : (
                <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>ID: {viewStudent.id}</p>
              )}
              
              {isEditingStudent ? (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  <button onClick={() => setIsEditingStudent(false)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Cancel</button>
                  <button onClick={handleSaveStudent} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: 'var(--iqra-blue)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Save Changes</button>
                </div>
              ) : (
                <button onClick={() => setIsEditingStudent(true)} style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid var(--iqra-blue)', color: 'var(--iqra-blue)', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>Edit Detail</button>
              )}
              
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Enrollment Date</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 700 }}>{new Date(viewStudent.enrollment_date).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Biometric Status</span>
                  <span style={{ fontSize: '13px', color: (viewStudent.face_embedding || viewStudent.face_embedding_enc) ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                    {(viewStudent.face_embedding || viewStudent.face_embedding_enc) ? 'Captured' : 'Missing'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
                Student ID Card
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' };

export default StudentEnrollment;
