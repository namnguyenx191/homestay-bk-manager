/**
 * Map axios errors to a short reason code for i18n, or return a plain message string.
 */
export function parseApiError(error) {
  if (!error.response) {
    const code = error.code || '';
    const msg = error.message || '';
    if (code === 'ERR_NETWORK' || msg === 'Network Error') {
      return { code: 'NETWORK' };
    }
    return { message: msg || undefined };
  }

  const { status, data } = error.response;

  if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
    return { code: 'HTML_RESPONSE' };
  }

  if (data && typeof data === 'object') {
    if (Array.isArray(data.errors) && data.errors.length) {
      const first = data.errors.find((e) => e?.msg);
      if (first?.msg) return { message: first.msg };
    }
    if (typeof data.message === 'string' && data.message) {
      return { message: status ? `${data.message} (HTTP ${status})` : data.message };
    }
  }

  return { message: status ? `HTTP ${status}` : undefined };
}
