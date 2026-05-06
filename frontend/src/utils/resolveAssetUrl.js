/**
 * Turn relative upload paths into absolute URLs using the same origin as VITE_API_URL.
 */
export function resolveAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
  let origin;
  if (apiBase.startsWith('/')) {
    origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  } else {
    try {
      const u = new URL(apiBase);
      origin = `${u.protocol}//${u.host}`;
    } catch {
      origin = String(apiBase).replace(/\/api\/?$/, '');
    }
  }
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return trimmed;
}
