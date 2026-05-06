import { io } from 'socket.io-client';

let socket;

function resolveSocketOrigin() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  const api = import.meta.env.VITE_API_URL || '';
  if (import.meta.env.DEV && (!api || api.startsWith('/'))) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  }
  if (api.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  }
  try {
    const u = new URL(api || 'http://127.0.0.1:5050/api');
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://127.0.0.1:5050';
  }
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
