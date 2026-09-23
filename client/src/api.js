// All communication between React and Express goes through this file.
// The frontend and API are served from the same origin, so the browser
// automatically sends the HttpOnly "token" cookie with every request.
// React never sees or stores the JWT (no localStorage, no Authorization header).

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || data?.error || `Request failed (${response.status})`,
      data?.details || []
    );
  }
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  listCapsules: () => request('/api/capsules'),
  createCapsule: (capsule) => request('/api/capsules', { method: 'POST', body: capsule }),
  updateCapsule: (id, capsule) => request(`/api/capsules/${id}`, { method: 'PUT', body: capsule }),
  deleteCapsule: (id) => request(`/api/capsules/${id}`, { method: 'DELETE' }),
};

// Options shown in the form (the server validates the same lists).
export const CATEGORIES = ['Coding', 'Debugging', 'Writing', 'Research', 'Study', 'Design', 'Other'];
export const USEFULNESS = ['Very Useful', 'Good', 'Needs Improvement', 'Not Useful'];

// SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS".
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}
