export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
const BASE = `${API_ORIGIN}/api/v1`;

let token = null;
try { token = localStorage.getItem('token'); } catch { /* storage blocked */ }

export const hasToken = () => Boolean(token);

export function setToken(t) {
  token = t;
  try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || 'Request failed');
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}

// body may be a plain object (sent as JSON) or FormData (multipart, for photos)
export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null))}` : '';
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { method, headers, body: body instanceof FormData ? body : body && JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the server. Check your connection or that the API is running.' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('auth:expired')); }
    throw new ApiError(res.status, json.error);
  }
  return { data: json.data, meta: json.meta };
}

export const imageUrl = (p) => (p?.startsWith('http') ? p : `${API_ORIGIN}${p}`);
