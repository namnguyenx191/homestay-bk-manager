import axios from 'axios';

const normalizeApiBase = (value) => String(value || '').replace(/\/+$/, '');

const envApi = normalizeApiBase(import.meta.env.VITE_API_URL);
const primaryBase =
  envApi ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:5050/api');

const fallbackBase =
  primaryBase === '/api'
    ? 'http://127.0.0.1:5050/api'
    : primaryBase.includes(':5050')
      ? 'http://127.0.0.1:5000/api'
      : primaryBase.includes(':5000')
        ? 'http://127.0.0.1:5050/api'
        : null;

const client = axios.create({
  baseURL: primaryBase,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error?.config;
    if (!cfg || cfg._baseRetried || !fallbackBase) throw error;
    if (error?.code !== 'ERR_NETWORK') throw error;
    cfg._baseRetried = true;
    cfg.baseURL = fallbackBase;
    return client(cfg);
  }
);

export default client;
