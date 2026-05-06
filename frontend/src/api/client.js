import axios from 'axios';
import { getApiBaseForClient } from '../config/apiBase';

const primaryBase = getApiBaseForClient();
const devPort = import.meta.env.VITE_BACKEND_PORT || '5050';

const fallbackBase =
  import.meta.env.DEV && primaryBase === '/api'
    ? `http://127.0.0.1:${devPort}/api`
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
