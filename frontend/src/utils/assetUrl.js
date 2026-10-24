// Server-relative upload paths (e.g. "/api/files/<id>" or "/uploads/<file>")
// must be requested from the backend origin, not from the frontend origin.
const ASSET_CACHE_VERSION = '2';

export const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  const url = `${base}${value}`;
  if (!value.startsWith('/api/files/')) return url;
  // Uploaded files are immutable; the version also bypasses stale cached responses.
  return `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_CACHE_VERSION}`;
};

// Ask the backend to send the file as an attachment, so Download works even
// though the file is served from a different origin than the app.
export const resolveAssetDownloadUrl = (value) => {
  const url = resolveAssetUrl(value);
  if (!url) return '';
  if (!value.startsWith('/api/files/') && !value.startsWith('/uploads/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}download=1`;
};
