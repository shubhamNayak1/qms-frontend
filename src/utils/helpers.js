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

/**
 * Turn a raw HTTP User-Agent string into a compact label the Audit Trail
 * table can show without wrapping — "Chrome 148 on macOS", "Safari 17 on
 * iOS", "Edge 128 on Windows". The full UA stays available to the caller
 * for a tooltip or export; this function only produces the display.
 *
 * We check browsers in a specific order because the strings overlap:
 * Edge / Opera / Chrome / Safari all contain "Safari"; Edge contains
 * "Chrome"; so pick the most-specific match first.
 */
export const formatUserAgent = (ua) => {
  if (!ua || typeof ua !== 'string') return '—';
  const s = ua;

  let browser = null;
  const pick = (name, ...patterns) => {
    if (browser) return;
    for (const p of patterns) {
      const m = s.match(p);
      if (m) { browser = { name, version: m[1] ? m[1].split('.')[0] : '' }; return; }
    }
  };
  pick('Edge',    /Edg(?:e|A|iOS)?\/(\d+)/);
  pick('Opera',   /OPR\/(\d+)/, /Opera\/(\d+)/);
  pick('Brave',   /Brave\/(\d+)/);
  pick('Firefox', /Firefox\/(\d+)/, /FxiOS\/(\d+)/);
  pick('Chrome',  /Chrome\/(\d+)/, /CriOS\/(\d+)/);
  pick('Safari',  /Version\/(\d+)[\d.]* Safari/);

  let os = null;
  if      (/Windows NT/.test(s))                       os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(s))                 os = 'iOS';
  else if (/Android/.test(s))                          os = 'Android';
  else if (/Mac OS X|Macintosh/.test(s))               os = 'macOS';
  else if (/Linux/.test(s))                            os = 'Linux';

  if (!browser && !os) {
    // Fallback — first 40 chars so the table doesn't wrap on an unknown UA.
    return s.length > 40 ? `${s.slice(0, 37)}…` : s;
  }
  const b = browser ? `${browser.name}${browser.version ? ' ' + browser.version : ''}` : 'Browser';
  return os ? `${b} on ${os}` : b;
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
