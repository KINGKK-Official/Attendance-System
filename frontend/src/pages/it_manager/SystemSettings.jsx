import { useState, useEffect } from 'react';
import api from '../../api';

const GOLD = 'var(--iqra-gold)';

const SystemSettings = () => {
  const [settings, setSettings] = useState({ face_comparison_threshold: 0.363, face_detection_threshold: 0.6, double_hit_interval: 30 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [diag, setDiag] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    fetchSettings(); refreshDiag(); refreshSessions(); refreshAudit();
    const t = setInterval(() => { refreshDiag(); refreshSessions(); }, 5000);
    return () => clearInterval(t);
  }, []);

  async function fetchSettings() { try { const r = await api.get('/api/it-manager/settings'); setSettings(r.data); } catch (e) {} };
  async function refreshDiag() { try { const r = await api.get('/api/it-manager/diagnostics'); setDiag(r.data); } catch (e) {} };
  async function refreshSessions() { try { const r = await api.get('/api/it-manager/sessions'); setSessions(r.data); } catch (e) {} };
  async function refreshAudit() { try { const r = await api.get('/api/it-manager/audit?limit=25'); setAudit(r.data); } catch (e) {} };

  const handleSlider = (e) => { const { name, value } = e.target; setSettings(p => ({ ...p, [name]: parseFloat(value) })); };
  const handleInput = (e) => { const { name, value } = e.target; setSettings(p => ({ ...p, [name]: value })); };

  async function handleSave() {
    setLoading(true);
    try {
      await api.post('/api/it-manager/settings', {
        face_comparison_threshold: parseFloat(settings.face_comparison_threshold),
        face_detection_threshold: parseFloat(settings.face_detection_threshold),
        double_hit_interval: parseInt(settings.double_hit_interval, 10),
      });
      setMessage('Configurations saved successfully.'); refreshAudit();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { setMessage(err.response?.data?.detail || 'Failed to save.'); }
    finally { setLoading(false); }
  };

  async function killSession() { try { await api.delete(`/api/it-manager/sessions/${id}`); refreshSessions(); refreshAudit(); } catch (e) {} };
  const pct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>System Settings & Diagnostics</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>Manage biometric thresholds, live monitoring sessions, and audit server health.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Biometric Matching Sensitivity</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>Fine-tune CV performance to balance false acceptance vs false rejection.</p>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Face Comparison Threshold (Cosine Similarity)</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#F59E0B' }}>{Number(settings.face_comparison_threshold).toFixed(3)}</span>
            </div>
            <input type="range" name="face_comparison_threshold" min="0" max="1" step="0.001" value={settings.face_comparison_threshold} onChange={handleSlider} style={{ width: '100%', cursor: 'pointer', accentColor: '#475569' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Higher value = stricter matching. Recommended: 0.363.</p>
          </div>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Face Detection Threshold (YuNet Score)</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#F59E0B' }}>{Number(settings.face_detection_threshold).toFixed(2)}</span>
            </div>
            <input type="range" name="face_detection_threshold" min="0" max="1" step="0.01" value={settings.face_detection_threshold} onChange={handleSlider} style={{ width: '100%', cursor: 'pointer', accentColor: '#475569' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Detection confidence threshold. Recommended: 0.60.</p>
          </div>
          <div style={{ marginBottom: '40px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Double-Hit Interval (Seconds)</label>
            <input type="number" name="double_hit_interval" value={settings.double_hit_interval} onChange={handleInput} className="input-field" style={{ width: '100px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Interval between biometric capture hits. Recommended: 30s.</p>
          </div>
          <button onClick={handleSave} disabled={loading} style={{ padding: '12px 24px', background: GOLD, color: '#0F172A', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Configurations'}</button>
          {message && <span style={{ marginLeft: '16px', color: '#10B981', fontSize: '14px' }}>{message}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Server Diagnostics</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Real-time host utilization (auto-refresh 5s).</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <Stat label="CPU Load" value={pct(diag?.cpu_load)} />
              <Stat label="RAM Usage" value={pct(diag?.ram_usage)} />
              <Stat label="Database Ping" value={diag ? `${diag.db_ping_ms}ms` : '—'} />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Tag ok={diag?.ffmpeg}>ffmpeg {diag?.ffmpeg ? 'ready' : 'missing'}</Tag>
              <Tag ok={diag?.ffprobe}>ffprobe {diag?.ffprobe ? 'ready' : 'missing'}</Tag>
              <Tag ok={diag?.audio_monitoring_enabled}>audio {diag?.audio_monitoring_enabled ? 'ON' : 'OFF'}</Tag>
              <Tag ok={diag?.disk_usage != null}>disk {pct(diag?.disk_usage)}</Tag>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Active Monitoring Sessions</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Who is viewing video or listening to audio now.</p>
            {sessions.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active sessions.</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div><span style={{ fontSize: '13px', fontWeight: 600 }}>{s.kind === 'audio' ? '🎧' : '📹'} {s.room_number}</span><span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{s.user_email}</span></div>
                <button onClick={() => killSession(s.id)} style={{ padding: '3px 10px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Kill</button>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Camera Connection Pings</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Cameras registered to rooms (credentials masked).</p>
            {(diag?.cameras || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div><div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{c.room_number}{c.has_audio ? ' 🔊' : ''}{c.has_ptz ? ' ↔' : ''}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.redacted_url || 'not configured'}</div></div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.configured ? '#10B981' : '#94A3B8' }} />{c.configured ? 'Configured' : 'Pending'}</div>
              </div>
            ))}
            {(!diag?.cameras || diag.cameras.length === 0) && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No cameras registered.</div>}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '30px', marginTop: '30px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>IT Audit Log</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Append-only record of camera, stream, and settings actions (latest 25).</p>
        <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
          <thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>IP</th></tr></thead>
          <tbody>
            {audit.map(r => (
              <tr key={r.id}>
                <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{(r.timestamp || '').replace('T', ' ').slice(0, 19)}</td>
                <td>{r.actor_email || '—'}</td>
                <td><span style={{ fontWeight: 600, color: r.action?.includes('audio') ? '#EF4444' : 'var(--text-main)' }}>{r.action}</span></td>
                <td>{r.target || '—'}</td>
                <td style={{ color: 'var(--text-muted)' }}>{r.ip_address || '—'}</td>
              </tr>
            ))}
            {audit.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (<div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</div><div style={{ fontSize: '24px', fontWeight: 'bold' }}>{value}</div></div>);
const Tag = ({ ok, children }) => (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ok ? '#10B981' : '#CBD5E1' }} />{children}</span>);

export default SystemSettings;
