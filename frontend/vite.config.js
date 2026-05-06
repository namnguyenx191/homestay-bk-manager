import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !String(env.VITE_API_URL || '').trim()) {
    throw new Error(
      'Production build requires VITE_API_URL (e.g. https://your-api.onrender.com/api). Set it in Vercel Environment Variables.'
    );
  }
  const backendPort = env.VITE_BACKEND_PORT || '5050';
  const target = `http://127.0.0.1:${backendPort}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      host: true,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
        '/socket.io': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
