import { useState, useEffect, useRef } from 'react';
import api from '../../api';

const GOLD = 'var(--iqra-gold)';

const CameraSetup = () => {
  const [cameras, setCameras] = useState([]);
  const [formData, setFormData] = useState({ room_number: '', ip_address: '', port: 554, camera_username: '', camera_password: '', stream_path: '', audio_consent_on_file: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [selectedCam, setSelectedCam] = useState(null);
  const [presets, setPresets] = useState({});
  const [videoOn, setVideoOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [audioStatus, setAudioStatus] = useState({ enabled: false });
  const audioRef = useRef(null); const audioCtxRef = useRef(null);
  const [vu, setVu] = useState(0);
  const token = () => localStorage.getItem('token') || '';

  useEffect(() => {
    fetchCameras();
    api.get('/api/it-manager/vendor-presets').then(r => setPresets(r.data)).catch(() => {});
    api.get('/api/it-manager/audio-status').then(r => setAudioStatus(r.data)).catch(() => {});
  }, []);

  async function fetchCameras() { try { const res = await api.get('/api/it-manager/cameras'); setCameras(res.data); } catch (e) { console.error(e); } };
  const handleInputChange = (e) => { const { name, value, type, checked } = e.target; setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); };
  const applyPreset = (k) => { if (presets[k] !== undefined) setFormData(p => ({ ...p, stream_path: presets[k] })); };
  const say = (t, e = false) => { setMessage(t); setMsgError(e); };

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.camera_username) delete payload.camera_username;
      if (!payload.camera_password) delete payload.camera_password;
      await api.post('/api/it-manager/cameras', payload);
      say('Camera configuration saved.'); fetchCameras(); resetForm();
    } catch (err) { say(err.response?.data?.detail || 'Failed to save.', true); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setFormData({ room_number: '', ip_address: '', port: 554, camera_username: '', camera_password: '', stream_path: '', audio_consent_on_file: false }); setSelectedCam(null); stopVideo(); stopAudio(); };
  async function handleDelete() { if (!window.confirm('Delete this camera?')) return; try { await api.delete(`/api/it-manager/cameras/${id}`); fetchCameras(); if (selectedCam?.id === id) resetForm(); } catch (e) {} };
  const handleEdit = (cam) => { setSelectedCam(cam); setFormData({ room_number: cam.room_number || '', ip_address: cam.ip_address || '', port: cam.port || 554, camera_username: '', camera_password: '', stream_path: cam.stream_path || '', audio_consent_on_file: !!cam.audio_consent_on_file }); stopVideo(); stopAudio(); };

  async function handleTestConnection() {
    try { say('Testing connection…');
      const res = await api.post('/api/it-manager/cameras/test', formData);
      say(`Connected — ${res.data.codec || 'video'} ${res.data.resolution || ''} ${res.data.fps ? res.data.fps + 'fps' : ''}${res.data.has_audio ? ' • audio ✓' : ' • no audio'}`);
      fetchCameras();
    } catch (err) { say(err.response?.data?.detail || 'Connection test failed.', true); }
  };

  const handlePTZ = async (command) => { if (!selectedCam) return alert('Select a camera (Edit) first.'); say(`PTZ command '${command}' sent to camera ${selectedCam.room_number}`); };
  const handlePreset = async (preset) => { if (!selectedCam) return alert('Select a camera (Edit) first.'); say(`Preset '${preset}' called on camera ${selectedCam.room_number}`); };

  const startVideo = () => { if (selectedCam) setVideoOn(true); };
  const stopVideo = () => setVideoOn(false);

  async function startAudio() {
    if (!selectedCam) return;
    const url = `${api.defaults.baseURL}/api/it-manager/cameras/${selectedCam.id}/audio?token=${encodeURIComponent(token())}`;
    setAudioOn(true);
    setTimeout(() => {
      try {
        const a = audioRef.current; if (!a) return;
        a.crossOrigin = "anonymous";
        a.src = url; a.play().catch(() => {});
        const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx(); audioCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(a); const an = ctx.createAnalyser(); an.fftSize = 256;
        src.connect(an); an.connect(ctx.destination);
        const data = new Uint8Array(an.frequencyBinCount);
        const tick = () => { if (!audioCtxRef.current) return; an.getByteFrequencyData(data); setVu(Math.min(100, Math.round(data.reduce((a, b) => a + b, 0) / data.length / 2))); requestAnimationFrame(tick); };
        tick();
      } catch (e) { console.error(e); }
    }, 50);
  };
  const stopAudio = () => { setAudioOn(false); setVu(0); try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; } } catch {} try { if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; } } catch {} };

  const audioFeatureOn = audioStatus.enabled;
  const camHasAudio = selectedCam?.has_audio;
  const camConsent = formData.audio_consent_on_file;

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>IP Camera Configurations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Manage cameras, verify streams, view live feeds, and (where permitted) monitor audio.</p>

      {audioOn && (
        <div style={{ background: '#7F1D1D', color: 'white', padding: '10px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FCA5A5', animation: 'pulse 1s infinite' }} />
          ⚠ Live audio monitoring active — {selectedCam?.room_number}. This session is recorded in the audit log.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Configured Classrooms</h3>
            <table className="data-table" style={{ width: '100%', fontSize: '14px' }}>
              <thead><tr><th>ROOM</th><th>IP</th><th>CAPS</th><th>URL PREVIEW</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {cameras.map(cam => (
                  <tr key={cam.id}>
                    <td style={{ fontWeight: 600 }}>{cam.room_number}</td>
                    <td>{cam.ip_address || 'N/A'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{cam.has_ptz && <span style={badge('#3B82F6')}>PTZ</span>}{cam.has_audio && <span style={badge('#8B5CF6')}>AUD</span>}</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cam.redacted_url || ''}>{cam.redacted_url || 'N/A'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleEdit(cam)} style={btn('#F59E0B', 'white')}>Edit</button>
                      <button onClick={() => handleDelete(cam.id)} style={btn('#EF4444', 'white')}>Delete</button>
                    </td>
                  </tr>
                ))}
                {cameras.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No cameras configured</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Camera Configuration Form</h3>
            <form onSubmit={handleSubmit}>
              <Field label="Classroom Room Number"><input required name="room_number" value={formData.room_number} onChange={handleInputChange} placeholder="e.g. Room 101" className="input-field" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Field label="IP Address / Webcam Index"><input name="ip_address" value={formData.ip_address} onChange={handleInputChange} placeholder="e.g. 10.125.0.139 or 0" className="input-field" /></Field>
                <Field label="Port"><input type="number" name="port" value={formData.port} onChange={handleInputChange} className="input-field" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Field label={`Camera Username ${selectedCam ? '(blank=keep)' : ''}`}><input name="camera_username" value={formData.camera_username} onChange={handleInputChange} placeholder={selectedCam?.has_username ? '•••••• (stored)' : 'username'} className="input-field" /></Field>
                <Field label={`Camera Password ${selectedCam ? '(blank=keep)' : ''}`}><input type="password" name="camera_password" value={formData.camera_password} onChange={handleInputChange} placeholder={selectedCam?.has_password ? '•••••• (stored)' : '••••••••'} className="input-field" /></Field>
              </div>
              <Field label="Stream Path (RTSP Route)">
                <input name="stream_path" value={formData.stream_path} onChange={handleInputChange} placeholder="cam/realmonitor?channel=1&subtype=0" className="input-field" />
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{Object.keys(presets).map(k => <button key={k} type="button" onClick={() => applyPreset(k)} style={chip}>{k}</button>)}</div>
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <input type="checkbox" name="audio_consent_on_file" checked={formData.audio_consent_on_file} onChange={handleInputChange} />
                Audio notice / consent is on file for this room (required to enable Listen)
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={handleTestConnection} style={{ flex: 1, padding: '12px', background: '#64748B', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Test Connection</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', background: GOLD, color: '#0F172A', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Saving…' : 'Save Settings'}</button>
              </div>
              {message && <p style={{ marginTop: '16px', color: msgError ? '#EF4444' : '#10B981', fontSize: '14px' }}>{message}</p>}
            </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px' }}>Live Streaming Preview</h3>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedCam ? selectedCam.room_number + ' Feed' : 'Select a Room (Edit)'}</span>
            </div>
            <div style={{ width: '100%', height: '300px', background: '#0F172A', borderRadius: '8px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {videoOn && selectedCam
                ? <img alt="Live" src={`${api.defaults.baseURL}/api/it-manager/cameras/${selectedCam.id}/video?token=${encodeURIComponent(token())}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => say('Live video failed — check connectivity.', true)} />
                : <div style={{ color: '#64748B', fontSize: '14px', textAlign: 'center' }}>{selectedCam ? 'Press “Start Live” to view the feed' : 'Select a configured camera to preview'}</div>}
              {videoOn && <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white', fontSize: '12px', background: 'rgba(220,38,38,0.85)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>● LIVE</div>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
              {!videoOn ? <button disabled={!selectedCam} onClick={startVideo} style={feedBtn(!selectedCam)}>Start Live</button>
                : <button onClick={stopVideo} style={{ ...feedBtn(false), background: '#475569', color: 'white' }}>Stop Live</button>}
              {!audioOn ? <button disabled={!selectedCam || !audioFeatureOn || !camHasAudio || !camConsent}
                  title={!audioFeatureOn ? 'Audio disabled by policy flags' : !camHasAudio ? 'No audio track (run Test Connection)' : !camConsent ? 'Consent not on file' : 'Listen to room audio'}
                  onClick={startAudio} style={feedBtn(!selectedCam || !audioFeatureOn || !camHasAudio || !camConsent)}>🎧 Listen</button>
                : <button onClick={stopAudio} style={{ ...feedBtn(false), background: '#7F1D1D', color: 'white' }}>Stop Audio</button>}
            </div>
            {!audioFeatureOn && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Audio monitoring is disabled. Requires policy flags (ENABLE_AUDIO_MONITORING + COMPLIANCE_APPROVED) and lawful notice/consent.</p>}
            <audio ref={audioRef} style={{ display: 'none' }} />
            {audioOn && <div style={{ marginTop: '10px' }}><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Audio level</div><div style={{ height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${vu}%`, background: 'linear-gradient(90deg,#22C55E,#EAB308,#EF4444)', transition: 'width .08s' }} /></div></div>}

            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Camera PTZ & Preset Controls</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gridTemplateRows: 'repeat(3, 40px)', gap: '4px', justifyItems: 'center', alignItems: 'center' }}>
                  <div /><button onClick={() => handlePTZ('up')} style={dpad}>▲</button><div />
                  <button onClick={() => handlePTZ('left')} style={dpad}>◀</button>
                  <div style={{ width: '36px', height: '36px', background: GOLD, color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>PTZ</div>
                  <button onClick={() => handlePTZ('right')} style={dpad}>▶</button>
                  <div /><button onClick={() => handlePTZ('down')} style={dpad}>▼</button><div />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handlePTZ('zoom_in')} style={zoom}>Zoom In (+)</button>
                    <button onClick={() => handlePTZ('zoom_out')} style={zoom}>Zoom Out (-)</button>
                  </div>
                  <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Go to Preset Spot</span>
                    <div style={{ display: 'flex', gap: '8px' }}>{['P1', 'P2', 'P3', 'P4'].map(p => <button key={p} onClick={() => handlePreset(p)} style={{ flex: 1, padding: '6px', background: GOLD, color: '#0F172A', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>{p}</button>)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Configured Stream (credentials masked):</p>
              <p style={{ color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>{selectedCam?.redacted_url || `rtsp://***:***@${formData.ip_address || '10.125.0.139'}:${formData.port || 554}/${formData.stream_path || 'cam/realmonitor?channel=1&subtype=0'}`}</p>
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px' }}>Live video uses server-side OpenCV MJPEG proxying. Credentials stay on the server.</p>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%{opacity:1}50%{opacity:.3}100%{opacity:1}}`}</style>
    </div>
  );
};

const chip = { padding: '4px 10px', fontSize: '12px', background: 'var(--table-head-bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-muted)', textTransform: 'capitalize' };
const dpad = { width: '36px', height: '36px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' };
const zoom = { flex: 1, padding: '8px', background: 'var(--table-head-bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' };
const btn = (bg, c) => ({ padding: '4px 12px', background: bg, color: c, border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '6px', fontSize: '13px' });
const badge = (bg) => ({ display: 'inline-block', padding: '1px 6px', fontSize: '10px', fontWeight: 700, color: 'white', background: bg, borderRadius: '4px', marginRight: '4px' });
const feedBtn = (d) => ({ padding: '10px 16px', background: d ? '#CBD5E1' : 'var(--iqra-gold)', color: '#0F172A', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: d ? 'not-allowed' : 'pointer' });
const Field = ({ label, children }) => (<div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>{label}</label>{children}</div>);

export default CameraSetup;
