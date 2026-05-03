import { TOKEN_KEY, USER_KEY } from './constants';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export const setUser = (user) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user));

export const isAuthenticated = () => !!getToken();

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

/**
 * formatDateTime — date + 24-hour time, used wherever an action timestamp
 * is shown (audit history, workflow comments, etc.).
 * Example: "02 May 2026, 14:35"
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
};

export const getStatusColor = (status) => {
  const map = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    DRAFT: 'info',
    PUBLISHED: 'success',
    ARCHIVED: 'default',
    OPEN: 'warning',
    CLOSED: 'success',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
  };
  return map[status?.toUpperCase()] || 'default';
};
