/**
 * HTTP client for the UG-ARMS API.
 *
 * All requests go to the versioned API on the same origin (through the Vite proxy in development and Nginx in
 * production). VITE_API_BASE_URL can point elsewhere, which also requires matching CORS, cookie domain and SameSite
 * settings on the API (see docs/deployment-guide.md). Sessions use HTTP-only cookies, so no token is ever stored in
 * the browser. State-changing requests carry the CSRF token, and an expired access token is refreshed
 * transparently, once at a time, before the original request is retried.
 *
 * @author Kwasi Adabo Boakye
 */

import axios from 'axios';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 60000 });

/**
 * Converts a path issued by the server ("/api/v1/...") into a URL under the configured API base.
 *
 * @param {string} path Server-issued path.
 * @returns {string}
 */
export const apiUrl = (path) => path.replace(/^\/api\/v1/, API_BASE);

/**
 * Reports a browser error to the API: the message, stack trace and current route only, never form contents. The
 * report is sent in the background and never throws.
 *
 * @param {Error|*} error The error.
 */
export function reportClientError(error) {
  try {
    const body = {
      message: String(error?.message || error).slice(0, 500),
      stack: String(error?.stack || '').slice(0, 4000),
      route: window.location.pathname.slice(0, 300),
    };
    fetch(`${API_BASE}/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Reads the value of a cookie that JavaScript may access (used only for the CSRF token).
 *
 * @param {string} name Cookie name.
 * @returns {string|undefined}
 */
const readCookie = (name) =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1];

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('ugarms_csrf');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

let refreshing = null;

/**
 * Called when the session cannot be refreshed. Replaced at start-up by `setSessionExpiredHandler`.
 */
let onSessionExpired = () => {};

/**
 * Sets the function called when the session has expired and cannot be refreshed, typically to sign the user out of
 * the interface.
 *
 * @param {() => void} fn The handler.
 */
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

// Transparent access-token refresh: one refresh at a time; the original request is retried once.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith('/auth/');
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        refreshing ??= api.post('/auth/refresh').finally(() => {
          refreshing = null;
        });
        await refreshing;
        return api(config);
      } catch {
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Returns a message that can be shown to the user for a failed request: the API's own message, a timeout message, a
 * connection message, or the fallback.
 *
 * @param {*} err The error thrown by axios.
 * @param {string} [fallback] Message used when nothing more specific is available.
 * @returns {string}
 */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const e = err?.response?.data?.error;
  if (e?.message) return e.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (!err?.response) return 'Cannot reach the server. Check your connection.';
  return fallback;
}

/**
 * Extracts field-level validation errors from a 422 response, for display next to form fields.
 *
 * @param {*} err The error thrown by axios.
 * @returns {Record<string, string>} Message keyed by field path.
 */
export function fieldErrors(err) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.path).map((d) => [d.path, d.message]));
}

/**
 * Resolves an axios promise to the response body.
 *
 * @param {Promise<import('axios').AxiosResponse>} p The request.
 * @returns {Promise<*>}
 */
export const unwrap = (p) => p.then((r) => r.data);

/**
 * Requests a file and saves it in the browser, using the name from the Content-Disposition header unless one is
 * given.
 *
 * @param {string} url API path.
 * @param {{ method?: string, data?: *, filename?: string }} [options]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function download(url, { method = 'get', data, filename } = {}) {
  const res = await api.request({ url, method, data, responseType: 'blob' });
  const name = filename || /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] || '')?.[1] || 'download';
  const href = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href, download: decodeURIComponent(name) });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return res;
}
