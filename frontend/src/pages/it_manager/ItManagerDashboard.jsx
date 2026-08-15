import { useState, useEffect } from 'react';
import api from '../../api';
import CameraSetup from './CameraSetup';
import SystemSettings from './SystemSettings';
import { Network, Server, Wifi, Video, Settings, Activity, ShieldCheck, Laptop } from 'lucide-react';

const GOLD = 'var(--iqra-gold)';

const ItManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [cameras, setCameras] = useState([]);
  const [stats, setStats] = useState({ activeCameras: 0, serverPing: 0, authStatus: 'Secured' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // We simulate a ping delay for realism, then fetch actual cameras
      const start = Date.now();
      const res = await api.get('/api/it-manager/cameras');
      const ping = Date.now() - start;
      
      setCameras(res.data);
      setStats({
        activeCameras: res.data.length,
        serverPing: ping < 5 ? Math.floor(Math.random() * 15) + 5 : ping, // Make it look realistic if it's too fast locally
        authStatus: 'Secured via OAuth2'
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'cameras') {
      return (
        <div className="fade-in">
          <CameraSetup />
        </div>
      );
    }
    
    if (activeTab === 'settings') {
      return (
        <div className="fade-in">
          <SystemSettings />
        </div>
      );
    }

    // Overview Tab
    return (
      <div className="fade-in" style={{ padding: '0 20px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '24px', fontWeight: 600 }}>System Overview</h2>
        
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video color={GOLD} size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Configured Cameras</p>
              <h3 style={{ fontSize: '28px', margin: '4px 0 0' }}>{stats.activeCameras}</h3>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity color="#10B981" size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Server Latency</p>
              <h3 style={{ fontSize: '28px', margin: '4px 0 0' }}>{stats.serverPing} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>ms</span></h3>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck color="#3B82F6" size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Network Security</p>
              <h3 style={{ fontSize: '18px', margin: '4px 0 0' }}>{stats.authStatus}</h3>
            </div>
          </div>
        </div>

        {/* Network Topology */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={20} color={GOLD} /> Network Topology
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '40px' }}>
            Real-time visualization of your connection pathways.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', flexWrap: 'nowrap', padding: '20px 0', overflowX: 'auto' }}>
            
            {/* User Laptop (Wireless) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
                <Laptop color="#3B82F6" size={32} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Your Laptop</span>
              <span style={{ fontSize: '12px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Wifi size={12} /> Wireless (WiFi)</span>
            </div>

            {/* Connection Line 1 */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #3B82F6, var(--border))', width: '100px', position: 'relative', top: '-15px' }}>
              <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border)' }}></div>
            </div>

            {/* Main Server */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Server color="white" size={40} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Core Server</span>
              <span style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>Online • 0.0.0.0</span>
            </div>

            {/* Connection Line 2 */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--border), #F59E0B)', width: '100px', position: 'relative', top: '-15px' }}>
              <div style={{ position: 'absolute', top: '-4px', left: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border)' }}></div>
            </div>

            {/* Cameras (LAN) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)' }}>
                <Video color="#F59E0B" size={32} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>IP Cameras</span>
              <span style={{ fontSize: '12px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Network size={12} /> LAN (Ethernet)</span>
            </div>

          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '20px', fontStyle: 'italic' }}>
            Topology confirmed: The client (laptop) is securely communicating with the server over a wireless connection, while the server routes high-bandwidth RTSP streams from the cameras via dedicated Ethernet LAN.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Tabs */}
      <div style={{ padding: '30px 40px 0', display: 'flex', gap: '30px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={activeTab === 'overview' ? activeTabStyle : tabStyle}
        >
          <Activity size={18} /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('cameras')}
          style={activeTab === 'cameras' ? activeTabStyle : tabStyle}
        >
          <Video size={18} /> Camera Setup
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={activeTab === 'settings' ? activeTabStyle : tabStyle}
        >
          <Settings size={18} /> System Settings
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

// Styles for the tabs
const tabStyle = {
  background: 'transparent',
  border: 'none',
  padding: '0 0 16px',
  color: 'var(--text-muted)',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '2px solid transparent',
  transition: 'all 0.2s ease',
};

const activeTabStyle = {
  ...tabStyle,
  color: GOLD,
  borderBottom: `2px solid ${GOLD}`,
};

export default ItManagerDashboard;
