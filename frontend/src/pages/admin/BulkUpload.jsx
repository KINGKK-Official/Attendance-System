import { useState } from 'react';
import api from '../../api';

function BulkUpload() {
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState('courses');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage('');
    setErrors([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/api/bulk-upload/${uploadType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(response.data.message);
      if (response.data.success === false && response.data.errors) {
        setErrors(response.data.errors);
      }
    } catch (err) {
      if (err.response?.data?.success === false && err.response?.data?.errors) {
         setMessage(err.response.data.message);
         setErrors(err.response.data.errors);
      } else {
         setMessage(err.response?.data?.detail || err.response?.data?.message || 'Error uploading file');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>Bulk Upload</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Import batches of records via Excel files</p>
      </div>
      
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>Upload Target</label>
            <select 
              className="input-field"
              value={uploadType} 
              onChange={(e) => setUploadType(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white', outline: 'none' }}
            >
              <option value="courses">Courses</option>
              <option value="students">Students</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>Select .xlsx File</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                accept=".xlsx" 
                onChange={(e) => setFile(e.target.files[0])}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '2px dashed var(--border)', 
                  backgroundColor: 'var(--bg-main)', 
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn" disabled={loading || !file} style={{ padding: '12px 32px', backgroundColor: loading || !file ? '#E2E8F0' : 'var(--iqra-blue)', color: loading || !file ? '#94A3B8' : 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: loading || !file ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {loading ? 'Processing Upload...' : 'Upload Data'}
            </button>
          </div>
        </form>
      </div>

      {message && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', borderLeft: errors.length ? '4px solid #EF4444' : '4px solid #10B981' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--text-main)' }}>Upload Result</h4>
          <p style={{ margin: 0, color: errors.length ? '#991B1B' : '#065F46', fontWeight: 500 }}>{message}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ color: '#EF4444', margin: '0 0 16px 0', fontSize: '18px' }}>Validation Errors</h4>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', width: '80px' }}>Row</th>
                <th style={{ padding: '12px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Error Description</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e, idx) => (
                <tr key={idx} style={{ borderBottom: idx !== errors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{e.row}</td>
                  <td style={{ padding: '12px', color: '#EF4444' }}>{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BulkUpload;
