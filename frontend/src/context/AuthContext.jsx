import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await axios.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, refresh_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  async function logout() {
    // Task 5: revoke the refresh token server-side, best-effort
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        await axios.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${refresh}` } });
      } catch (e) { /* ignore */ }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  async function loginWithGoogle(token) {
    const response = await axios.post('/api/auth/google', { token });
    const { access_token, refresh_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  async function loginWithMicrosoft(token) {
    const response = await axios.post('/api/auth/microsoft', { token });
    const { access_token, refresh_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, loginWithMicrosoft, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
