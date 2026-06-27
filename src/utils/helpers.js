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

// All timestamps are rendered in Indian Standard Time (UTC+5:30).
// We force the timezone explicitly so a tester whose Windows machine is set
// to UTC, PST, etc. still sees the same IST timestamps the auditor sees on
// site — critical for GxP audit trails.
const INDIA_TZ = 'Asia/Kolkata';

// Round-3 R11: every date is rendered as DD/MM/YYYY across the app (was
// "DD Mon YYYY"). Date input fields should also carry placeholder="DD/MM/YYYY".
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  // Use Intl in Asia/Kolkata to align with IST audit trails, then re-pack
  // the parts as DD/MM/YYYY. toLocaleDateString('en-GB') gives DD/MM/YYYY
  // natively but we keep the explicit re-pack so the format is locale-safe.
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: INDIA_TZ,
  }).formatToParts(d);
  const dd = parts.find(p => p.type === 'day')?.value || '';
  const mm = parts.find(p => p.type === 'month')?.value || '';
  const yyyy = parts.find(p => p.type === 'year')?.value || '';
  return `${dd}/${mm}/${yyyy}`;
};

/**
 * formatDateTime — date + 24-hour time in Indian Standard Time, used wherever
 * an action timestamp is shown (audit history, workflow comments, etc.).
 * Example: "02 May 2026, 14:35 IST"
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: INDIA_TZ,
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: INDIA_TZ,
  });
  return `${datePart}, ${timePart} IST`;
};

/**
 * Round-L (2026-06-27): "DD/MM/YYYY : HH:MM AM/PM" rendered in IST.
 * Used by the per-stage actor stamp so the workflow audit trail surfaces
 * the time-of-day as well as the date. Example: "27/06/2026 : 02:35 PM".
 */
export const formatDateTimeAmPm = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dateParts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: INDIA_TZ,
  }).formatToParts(d);
  const dd   = dateParts.find(p => p.type === 'day')?.value   || '';
  const mm   = dateParts.find(p => p.type === 'month')?.value || '';
  const yyyy = dateParts.find(p => p.type === 'year')?.value  || '';
  // en-US gives 12-hour with AM/PM. We pull hour + minute + dayPeriod
  // explicitly so the separator stays " : " and isn't locale-dependent.
  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: INDIA_TZ,
  }).formatToParts(d);
  const hh     = timeParts.find(p => p.type === 'hour')?.value      || '';
  const mins   = timeParts.find(p => p.type === 'minute')?.value    || '';
  const period = timeParts.find(p => p.type === 'dayPeriod')?.value || '';
  return `${dd}/${mm}/${yyyy} : ${hh}:${mins} ${period}`;
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
