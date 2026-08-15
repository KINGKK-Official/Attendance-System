import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider, useMsal } from '@azure/msal-react';

const msalConfig = {
  auth: {
    clientId: "YOUR_MICROSOFT_CLIENT_ID",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  }
};
const msalInstance = new PublicClientApplication(msalConfig);

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle, loginWithMicrosoft } = useAuth();
  const navigate = useNavigate();

  const { instance } = useMsal();

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle(tokenResponse.access_token);
      redirectAfterLogin();
    } catch (err) {
      setError(err.response?.data?.detail || 'Google SSO failed.');
      setLoading(false);
    }
  };

  const loginWithGoogleBtn = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google Login Failed')
  });

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const loginResponse = await instance.loginPopup({ scopes: ["user.read"] });
      await loginWithMicrosoft(loginResponse.accessToken);
      redirectAfterLogin();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Microsoft SSO failed.');
      setLoading(false);
    }
  };

  const redirectAfterLogin = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'ADMIN') navigate('/admin/dashboard');
      else if (user.role === 'FACULTY') navigate('/faculty/courses');
      else if (user.role === 'IT_MANAGER') navigate('/it-manager/dashboard');
      else if (user.role === 'STUDENT') navigate('/student/dashboard');
      else navigate('/');
    } else {
      navigate('/');
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      redirectAfterLogin();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      backgroundColor: 'var(--iqra-blue)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '20px'
    }}>
      
      {/* Top Branding Section */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>🏫</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.85)' }}>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>AI Automated Attendance System</span>
        </div>
      </div>

      {/* Login Card */}
      <div style={{ 
        width: '100%',
        maxWidth: '440px', 
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        border: '1px solid var(--border)',
        padding: '40px'
      }}>
        <h2 style={{ fontSize: '24px', color: 'var(--text-main)', marginBottom: '8px' }}>Portal Login</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
          Secure authentication for authorized personnel only.
        </p>
        
        {error && (
          <div style={{ 
            background: '#FEE2E2', color: '#991B1B', padding: '12px', 
            borderRadius: '6px', marginBottom: '24px', fontSize: '13px', border: '1px solid #FCA5A5'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '11px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Institutional Email / ID
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '18px' }}>@</span>
              <input 
                type="email" 
                placeholder="e.g. john.doe@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px 14px 14px 42px', borderRadius: '6px',
                  border: '1px solid var(--border)', fontSize: '14px', outline: 'none',
                  backgroundColor: '#F8FAFC', color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '11px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Security Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}>🔒</span>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px 42px 14px 42px', borderRadius: '6px',
                  border: '1px solid var(--border)', fontSize: '14px', outline: 'none',
                  backgroundColor: '#F8FAFC', color: 'var(--text-main)', letterSpacing: '0.1em'
                }}
              />
              <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>👁️</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '14px' }}>ⓘ</span>
            <p style={{ fontSize: '12px', fontStyle: 'italic', lineHeight: 1.4 }}>
              Role is automatically detected via backend verification.
            </p>
          </div>

          <button 
            type="submit" 
            style={{ 
              width: '100%', padding: '14px', fontSize: '14px', backgroundColor: 'var(--iqra-blue)', 
              color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
            }} 
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
            <span style={{ fontSize: '16px' }}>➔</span>
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-muted)' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
          <span style={{ margin: '0 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            type="button"
            onClick={() => loginWithGoogleBtn()}
            style={{ 
              width: '100%', padding: '12px', fontSize: '14px', backgroundColor: '#FFFFFF', 
              color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px', 
              cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', 
              alignItems: 'center', gap: '12px', transition: 'background-color 0.2s'
            }} 
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            disabled={loading}
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: '20px', height: '20px' }} />
            Login with Google
          </button>

          <button 
            type="button"
            onClick={handleMicrosoftLogin}
            style={{ 
              width: '100%', padding: '12px', fontSize: '14px', backgroundColor: '#FFFFFF', 
              color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px', 
              cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', 
              alignItems: 'center', gap: '12px', transition: 'background-color 0.2s'
            }} 
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            disabled={loading}
          >
            <img src="https://www.svgrepo.com/show/475666/microsoft-color.svg" alt="Microsoft" style={{ width: '20px', height: '20px' }} />
            Login with Microsoft
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a href="#" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
            Forgot Password?
          </a>
        </div>
      </div>

      {/* Footer Branding */}
      <div style={{ textAlign: 'center', marginTop: '48px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
          <span>🎧 Contact IT Support</span>
          <span>•</span>
          <span>🛡️ Privacy Policy</span>
        </div>
        <p style={{ opacity: 0.8 }}>© 2026 Academic Institution. Powered by CV-AI Framework v2.4.</p>
      </div>

    </div>
  );
};

const Login = () => {
  return (
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
      <MsalProvider instance={msalInstance}>
        <LoginForm />
      </MsalProvider>
    </GoogleOAuthProvider>
  );
};

export default Login;

