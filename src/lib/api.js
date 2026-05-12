export const API_BASE_URL = 'http://127.0.0.1:8082/api';

export async function postJson(path, body, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body != null ? body : {})
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text.slice(0, 120) || '非 JSON 响应' };
  }
}

export function getStoredToken() {
  return sessionStorage.getItem('accessToken') || '';
}

export function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  } catch {
    return null;
  }
}

export function setSessionAuth(token, user) {
  sessionStorage.setItem('accessToken', token || '');
  sessionStorage.setItem('currentUser', JSON.stringify(user));
}

export function clearSessionAuth() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('currentUser');
}
