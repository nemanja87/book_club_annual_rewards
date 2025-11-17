import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
});

api.interceptors.request.use((config) => {
  const adminSecret = localStorage.getItem('adminSecret');
  if (adminSecret && config.url?.startsWith('/api/admin')) {
    config.headers['X-Admin-Secret'] = adminSecret;
  }
  return config;
});

export function setAdminSecret(secret: string) {
  localStorage.setItem('adminSecret', secret);
}

export function getAdminSecret(): string | null {
  return localStorage.getItem('adminSecret');
}

export default api;
