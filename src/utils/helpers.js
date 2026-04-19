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
