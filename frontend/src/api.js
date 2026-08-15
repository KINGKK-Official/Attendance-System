// Central API configuration — imported first by main.jsx
import axios from 'axios';

// Single source of truth for the backend URL
// Do NOT set a global Content-Type — each request type sets its own
axios.defaults.baseURL = 'http://localhost:8000';

// Task 5: on a 401, try to silently refresh the access token once using the
// stored refresh token. If that fails, clear session and bounce to /login.
let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token = null) => {
  pendingQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)));
  pendingQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response && error.response.status;
    const refresh = localStorage.getItem('refresh_token');
    const isAuthCall = original.url && original.url.includes('/api/auth/');

    if (status === 401 && refresh && !original._retry && !isAuthCall) {
      if (isRefreshing) {
        // Queue requests while a refresh is in flight
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          original._retry = true;
          return axios(original);
        });
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const res = await axios.post('/api/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${refresh}` }
        });
        const newToken = res.data.access_token;
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        flushQueue(null, newToken);
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return axios(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axios;
