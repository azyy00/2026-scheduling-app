import axios from 'axios';
import { getToken, removeToken, tokenExpiresIn } from '../utils/auth';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Warn user 10 minutes before session expires
  const remaining = tokenExpiresIn();
  if (remaining > 0 && remaining <= 600 && !window._sessionWarnShown) {
    window._sessionWarnShown = true;
    const mins = Math.ceil(remaining / 60);
    setTimeout(() => {
      alert(`Your session will expire in ${mins} minute(s). Please save your work and log in again.`);
      window._sessionWarnShown = false;
    }, 0);
  }

  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      removeToken();
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
