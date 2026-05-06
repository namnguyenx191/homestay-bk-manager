import { io } from 'socket.io-client';

let socket;

function resolveSocketOrigin() {
  const socketEnv = String(import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
  if (socketEnv) return socketEnv;
  const api = String(import.meta.env.VITE_API_URL || '').trim();
  if (import.meta.env.DEV && (!api || api.startsWith('/'))) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  }
  if (api.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  }
  if (api) {
    try {
      const u = new URL(api);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  if (import.meta.env.DEV) return `http://127.0.0.1:${import.meta.env.VITE_BACKEND_PORT || '5050'}`;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export const getSocket = () => {
  if (!socket) {
    const opts = { transports: ['websocket'] };
    const url = resolveSocketOrigin();
    const proxied =
      import.meta.env.DEV && typeof window !== 'undefined' && url === window.location.origin;
    socket = io(url, proxied ? { ...opts, path: '/socket.io' } : opts);
  }
  return socket;
};
