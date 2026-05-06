/** Normalize API base: no trailing slash, includes /api suffix when using full URL. */
export const normalizeApiBase = (value) => String(value || '').trim().replace(/\/+$/, '');

/**
 * Base URL for axios (e.g. https://api.example.com/api or /api in dev).
 * Production builds must set VITE_API_URL (enforced in vite.config.js).
 */
export function getApiBaseForClient() {
  const envApi = normalizeApiBase(import.meta.env.VITE_API_URL);
  if (envApi) return envApi;
  if (import.meta.env.DEV) return '/api';
  return '';
}
