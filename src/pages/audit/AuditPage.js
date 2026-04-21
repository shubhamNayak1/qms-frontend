import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, Avatar, Stack, Collapse,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  Download as DownloadIcon, Login as LoginIcon, Logout as LogoutIcon,
  Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  CloudUpload as UploadIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ErrorAlert from '../../components/ErrorAlert';
import { formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';
import { searchAuditLogsApi, getAuditStatsApi } from '../../api/auditApi';

// ── Mock: Audit Schedules (no dedicated backend endpoint yet) ───────────────
const MOCK_AUDITS = [
  { id: 1, auditId: 'AUD-2024-Q1', title: 'Q1 Internal Quality Audit', type: 'Internal', scope: 'Production Floor', auditor: 'Alice Johnson', status: 'COMPLETED', scheduledDate: '2024-01-20', completedDate: '2024-01-22', findings: 3, observations: 2 },
  { id: 2, auditId: 'AUD-2024-Q2', title: 'Supplier Audit — ABC Components', type: 'Supplier', scope: 'Purchasing Dept', auditor: 'Emma Wilson', status: 'IN_PROGRESS', scheduledDate: '2024-04-10', completedDate: null, findings: 1, observations: 0 },
  { id: 3, auditId: 'AUD-2024-EXT', title: 'ISO 9001:2015 Certification Audit', type: 'External', scope: 'Full System', auditor: 'Third Party Body', status: 'PENDING', scheduledDate: '2024-05-15', completedDate: null, findings: 0, observations: 0 },
  { id: 4, auditId: 'AUD-2024-EHS', title: 'Environmental Health & Safety Audit', type: 'Internal', scope: 'Warehouse & Lab', auditor: 'Bob Martinez', status: 'COMPLETED', scheduledDate: '2024-02-10', completedDate: '2024-02-12', findings: 5, observations: 3 },
  { id: 5, auditId: 'AUD-2024-IT', title: 'IT Systems Security Audit', type: 'Internal', scope: 'IT Infrastructure', auditor: 'Carol Smith', status: 'SCHEDULED', scheduledDate: '2024-06-01', completedDate: null, findings: 0, observations: 0 },
];

const ACTION_ICON = {
  LOGIN: <LoginIcon fontSize="small" />,
  LOGOUT: <LogoutIcon fontSize="small" />,
  VIEW: <ViewIcon fontSize="small" />,
  READ: <ViewIcon fontSize="small" />,
  CREATE: <AddIcon fontSize="small" />,
  UPDATE: <EditIcon fontSize="small" />,
  UPLOAD: <UploadIcon fontSize="small" />,
  DELETE: <DeleteIcon fontSize="small" />,
  DOWNLOAD: <DownloadIcon fontSize="small" />,
};

const ACTION_COLOR = {
  info: '#1565C0',
  success: '#2E7D32',
  warning: '#E65100',
  error: '#C62828',
};

const severityFromLog = (action, outcome) => {
  if (outcome === 'FAILURE') return 'error';
  if (['CREATE', 'UPLOAD', 'ENROLL'].includes(action)) return 'success';
  if (['UPDATE', 'APPROVE', 'REJECT'].includes(action)) return 'warning';
  if (['DELETE'].includes(action)) return 'error';
  return 'info';
};

const normTrailRow = (r) => ({
  id: r.id,
  timestamp: r.timestamp,
  name: r.userFullName || r.username || 'System',
  username: r.username || '—',
  role: r.userRole || r.role || '—',
  action: r.action || '-',
  module: r.module || r.entityType || '-',
  description: r.description || '-',
  ipAddress: r.ipAddress || '-',
  sessionId: r.sessionId || '-',
  userAgent: r.userAgent || '-',
  requestUri: r.requestUri || '-',
  durationMs: r.durationMs,
  outcome: r.outcome,
  errorMessage: r.errorMessage,
  rawOldValue: r.oldValue || null,
  rawNewValue: r.newValue || null,
  severity: severityFromLog(r.action, r.outcome),
});

const KNOWN_MODULES = ['ALL', 'USER', 'CAPA', 'DEVIATION', 'INCIDENT', 'COMPLAINT', 'CHANGE_CONTROL', 'DMS', 'LMS', 'REPORTS', 'SYSTEM'];
const KNOWN_ACTIONS = ['ALL', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'UPLOAD', 'DOWNLOAD', 'APPROVE', 'REJECT', 'SYSTEM_EVENT'];

// ── Diff Viewer ────────────────────────────────────────────────────────────
const SKIP_FIELDS = new Set(['passwordChangedAt', 'updatedAt', 'createdAt']);

const truncate = (str, max = 120) =>
  str && str.length > max ? str.slice(0, max) + '…' : str;

const valToStr = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const DiffViewer = ({ oldValue, newValue, requestUri, durationMs, outcome, errorMessage }) => {
  let oldObj = null;
  let newObj = null;

  try { if (oldValue) oldObj = JSON.parse(oldValue); } catch (_) {}
  try { if (newValue) newObj = JSON.parse(newValue); } catch (_) {}

  const hasData = oldObj || newObj;
  const diffs = [];

  if (hasData) {
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    for (const key of allKeys) {
      if (SKIP_FIELDS.has(key)) continue;
      const oldStr = valToStr(oldObj?.[key]);
      const newStr = valToStr(newObj?.[key]);
      if (oldStr !== newStr) {
        const status = !oldObj ? 'added' : !newObj ? 'removed' : 'changed';
        diffs.push({ key, oldStr, newStr, status });
      }
    }
  }

  const STATUS_BG = { changed: '#FFF8E1', added: '#E8F5E9', removed: '#FFEBEE' };
  const STATUS_LABEL = { changed: 'CHANGED', added: 'ADDED', removed: 'REMOVED' };
  const STATUS_COLOR_MAP = { changed: 'warning', added: 'success', removed: 'error' };

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
      {/* Meta row */}
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {requestUri && requestUri !== '-' && (
          <Box>
            <Typography variant="caption" color="text.secondary">Request URI</Typography>
            <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{requestUri}</Typography>
          </Box>
        )}
        {durationMs != null && (
          <Box>
            <Typography variant="caption" color="text.secondary">Duration</Typography>
            <Typography variant="body2" fontWeight={500}>{durationMs} ms</Typography>
          </Box>
        )}
        {outcome && (
          <Box>
            <Typography variant="caption" color="text.secondary">Outcome</Typography>
            <Box><Chip label={outcome} size="small" color={outcome === 'SUCCESS' ? 'success' : 'error'} /></Box>
          </Box>
        )}
        {errorMessage && (
          <Box>
            <Typography variant="caption" color="text.secondary">Error</Typography>
            <Typography variant="body2" color="error.main" fontFamily="monospace">{errorMessage}</Typography>
          </Box>
        )}
      </Stack>

      {/* Diff table */}
      {hasData && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CompareIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={700}>
              {diffs.length > 0 ? `${diffs.length} field${diffs.length > 1 ? 's' : ''} changed` : 'No field changes detected'}
            </Typography>
          </Box>

          {diffs.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700, width: 160 }}>Field</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'error.dark', width: '40%' }}>Before</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'success.dark', width: '40%' }}>After</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90 }}>Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffs.map(({ key, oldStr, newStr, status }) => (
                    <TableRow key={key} sx={{ bgcolor: STATUS_BG[status] }}>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={700}>{key}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          sx={{ color: 'error.dark', wordBreak: 'break-all', display: 'block' }}
                        >
                          {truncate(oldStr) || <span style={{ color: '#999' }}>—</span>}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          sx={{ color: 'success.dark', wordBreak: 'break-all', display: 'block' }}
                        >
                          {truncate(newStr) || <span style={{ color: '#999' }}>—</span>}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={STATUS_LABEL[status]} size="small" color={STATUS_COLOR_MAP[status]} sx={{ fontSize: 9, height: 18 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {!hasData && !errorMessage && (
        <Typography variant="caption" color="text.secondary">No change data recorded for this event.</Typography>
      )}
    </Box>
  );
};

// ── Audit Dialog ───────────────────────────────────────────────────────────
const EMPTY_FORM = { title: '', type: 'Internal', scope: '', auditor: '', scheduledDate: '', objectives: '', checklist: '' };

const AuditDialog = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setForm(EMPTY_FORM); setErrors({}); } }, [open]);

  const validate = () => {
    const e = {};
    ['title', 'type', 'scope', 'auditor', 'scheduledDate'].forEach((k) => {
      if (!form[k]) e[k] = 'Required';
    });
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    onSave(form);
    setSaving(false);
    onClose();
  };

  const field = (label, key, opts = {}) => (
    <Grid item xs={opts.xs || 6} key={key}>
      {opts.select ? (
        <TextField label={label} select fullWidth size="small" value={form[key]} error={!!errors[key]}
          helperText={errors[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
          {opts.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      ) : (
        <TextField label={label} fullWidth size="small" type={opts.type || 'text'}
          multiline={opts.multiline} rows={opts.multiline ? 3 : 1}
          value={form[key]} error={!!errors[key]} helperText={errors[key]}
          InputLabelProps={opts.type === 'date' ? { shrink: true } : undefined}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
    </Grid>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Schedule New Audit</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {field('Audit Title', 'title', { xs: 12 })}
          {field('Audit Type', 'type', { select: true, options: ['Internal', 'External', 'Supplier', 'Regulatory'] })}
          {field('Scheduled Date', 'scheduledDate', { type: 'date' })}
          {field('Scope / Area', 'scope')}
          {field('Lead Auditor', 'auditor')}
          {field('Objectives', 'objectives', { xs: 12, multiline: true })}
          {field('Checklist / Standards', 'checklist', { xs: 12, multiline: true })}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Scheduling...' : 'Schedule Audit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const AuditPage = () => {
  const [tab, setTab] = useState(0);
  const [auditRows, setAuditRows] = useState(MOCK_AUDITS);
  const [trailRows, setTrailRows] = useState([]);
  const [totalTrail, setTotalTrail] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchTrail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedRows(new Set());
    try {
      const params = {
        page,
        size: rowsPerPage,
        ...(search ? { username: search } : {}),
        ...(moduleFilter !== 'ALL' ? { module: moduleFilter } : {}),
        ...(actionFilter !== 'ALL' ? { action: actionFilter } : {}),
      };
      const { data } = await searchAuditLogsApi(params);
      const payload = data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setTrailRows(items.map(normTrailRow));
      setTotalTrail(payload?.totalElements ?? items.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, actionFilter, page, rowsPerPage]);

  const fetchAuditSchedule = useCallback(() => {
    const q = search.toLowerCase();
    setAuditRows(
      MOCK_AUDITS.filter((r) =>
        !q || r.title.toLowerCase().includes(q) || r.auditId.toLowerCase().includes(q) || r.auditor.toLowerCase().includes(q)
      )
    );
  }, [search]);

  useEffect(() => {
    if (tab === 1) fetchTrail();
    else fetchAuditSchedule();
  }, [tab, fetchTrail, fetchAuditSchedule]);

  useEffect(() => {
    getAuditStatsApi().then(({ data }) => setStats(data?.data || null)).catch(() => {});
  }, []);

  const handleSaveAudit = (form) => {
    setAuditRows((prev) => [{
      id: Date.now(),
      auditId: `AUD-${new Date().getFullYear()}-${String(prev.length + 1).padStart(3, '0')}`,
      ...form,
      status: 'SCHEDULED',
      completedDate: null,
      findings: 0,
      observations: 0,
    }, ...prev]);
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const STATUS_COLOR = { COMPLETED: 'success', IN_PROGRESS: 'info', PENDING: 'warning', SCHEDULED: 'default' };
  const TRAIL_COL_SPAN = 11; // expand + # + Timestamp + User + Role + Action + Module + Description + IP + Session + Browser

  const summaryCards = [
    { label: 'Total Audits', value: auditRows.length, color: 'primary.main' },
    { label: 'Completed', value: auditRows.filter((a) => a.status === 'COMPLETED').length, color: 'success.main' },
    { label: 'In Progress', value: auditRows.filter((a) => a.status === 'IN_PROGRESS').length, color: 'info.main' },
    { label: 'Scheduled', value: auditRows.filter((a) => ['PENDING', 'SCHEDULED'].includes(a.status)).length, color: 'warning.main' },
    { label: 'Total Actions', value: stats?.totalActions ?? totalTrail, color: 'secondary.main' },
    { label: 'Failed Logins', value: stats?.failedLogins ?? trailRows.filter((t) => t.outcome === 'FAILURE' && t.action === 'LOGIN').length, color: 'error.main' },
  ];

  return (
    <Box>
      <PageHeader
        title="Audit Management"
        subtitle="Schedule audits and track every user action across the system."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Audit' }]}
        action={
          tab === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Schedule Audit
            </Button>
          )
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map(({ label, value, color }) => (
          <Grid item xs={6} sm={4} lg={2} key={label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2, px: 1 }}>
                <Typography variant="h4" fontWeight={700} color={color}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); setPage(0); }}>
          <Tab label="Audit Schedule" />
          <Tab label="User Activity Trail" />
        </Tabs>
      </Box>

      {/* ── TAB 0: Audit Schedule ─────────────────────────────────────────── */}
      {tab === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <TextField
              placeholder="Search audits..."
              size="small" value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 300 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Tooltip title="Refresh"><IconButton onClick={fetchAuditSchedule}><RefreshIcon /></IconButton></Tooltip>
          </Box>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Audit ID', 'Title', 'Type', 'Scope', 'Lead Auditor', 'Scheduled Date', 'Completed Date', 'Findings', 'Observations', 'Status'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{row.auditId}</Typography></TableCell>
                      <TableCell>{row.title}</TableCell>
                      <TableCell><Chip label={row.type} size="small" variant="outlined" /></TableCell>
                      <TableCell>{row.scope}</TableCell>
                      <TableCell>{row.auditor}</TableCell>
                      <TableCell>{formatDate(row.scheduledDate)}</TableCell>
                      <TableCell>{row.completedDate ? formatDate(row.completedDate) : <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                      <TableCell align="center"><Chip label={row.findings} size="small" color={row.findings > 0 ? 'error' : 'default'} /></TableCell>
                      <TableCell align="center"><Chip label={row.observations} size="small" color={row.observations > 0 ? 'warning' : 'default'} /></TableCell>
                      <TableCell><Chip label={row.status?.replace('_', ' ')} size="small" color={STATUS_COLOR[row.status] || 'default'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* ── TAB 1: User Activity Trail ────────────────────────────────────── */}
      {tab === 1 && (
        <>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search username..."
              size="small" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ width: 240 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="Module" select size="small" sx={{ minWidth: 140 }}
              value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(0); }}
            >
              {KNOWN_MODULES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField
              label="Action" select size="small" sx={{ minWidth: 150 }}
              value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            >
              {KNOWN_ACTIONS.map((a) => <MenuItem key={a} value={a}>{a.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <Tooltip title="Refresh"><IconButton onClick={fetchTrail}><RefreshIcon /></IconButton></Tooltip>
            <Tooltip title="Export Trail"><IconButton color="primary"><DownloadIcon /></IconButton></Tooltip>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {totalTrail} total records · {expandedRows.size > 0 ? `${expandedRows.size} expanded` : 'Click ▶ to expand a row and view change details'}
          </Typography>

          {error && <ErrorAlert message={error} onRetry={fetchTrail} />}

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: 'grey.50', width: 36, p: 0.5 }} />
                    {['#', 'Timestamp', 'User', 'Role', 'Action', 'Module', 'Description', 'IP Address', 'Session', 'Browser'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 600, bgcolor: 'grey.50', whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trailRows.map((row, idx) => {
                    const isExpanded = expandedRows.has(row.id);
                    const hasDiffData = row.rawOldValue || row.rawNewValue;
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          hover
                          sx={{
                            '&:hover': { bgcolor: 'grey.50' },
                            bgcolor: isExpanded ? 'primary.50' : 'inherit',
                          }}
                        >
                          {/* Expand toggle */}
                          <TableCell sx={{ p: 0.5, width: 36 }}>
                            <Tooltip title={isExpanded ? 'Collapse' : 'Expand details'}>
                              <IconButton
                                size="small"
                                onClick={() => toggleExpand(row.id)}
                                sx={{ opacity: hasDiffData || row.requestUri !== '-' ? 1 : 0.3 }}
                              >
                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>

                          <TableCell>
                            <Typography variant="caption" color="text.disabled">{page * rowsPerPage + idx + 1}</Typography>
                          </TableCell>

                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="caption" fontFamily="monospace">{formatTimestamp(row.timestamp)}</Typography>
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: 'primary.light' }}>
                                {row.name?.[0]?.toUpperCase() || '?'}
                              </Avatar>
                              <Box>
                                <Typography variant="caption" fontWeight={600} display="block" noWrap>{row.name}</Typography>
                                {row.username !== '—' && (
                                  <Typography variant="caption" color="text.secondary">@{row.username}</Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell>
                            {row.role !== '—' ? (
                              <Chip label={row.role} size="small" variant="outlined"
                                color={row.role === 'SUPER_ADMIN' ? 'error' : row.role === 'ADMIN' ? 'primary' : row.role === 'MANAGER' ? 'secondary' : 'default'}
                                sx={{ fontSize: 10 }}
                              />
                            ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ color: ACTION_COLOR[row.severity], display: 'flex' }}>
                                {ACTION_ICON[row.action] || <ViewIcon fontSize="small" />}
                              </Box>
                              <Chip
                                label={row.action?.replace(/_/g, ' ')}
                                size="small"
                                sx={{
                                  fontSize: 10, fontWeight: 600,
                                  bgcolor: `${ACTION_COLOR[row.severity]}18`,
                                  color: ACTION_COLOR[row.severity],
                                  border: `1px solid ${ACTION_COLOR[row.severity]}40`,
                                }}
                              />
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Chip label={row.module} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                          </TableCell>

                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="caption" sx={{ display: 'block' }}>{row.description}</Typography>
                          </TableCell>

                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace" color="text.secondary">{row.ipAddress}</Typography>
                          </TableCell>

                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                              {row.sessionId !== '-' ? row.sessionId : '—'}
                            </Typography>
                          </TableCell>

                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="caption" color="text.secondary">
                              {row.userAgent !== '-' ? row.userAgent : '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>

                        {/* Expandable detail row */}
                        <TableRow>
                          <TableCell colSpan={TRAIL_COL_SPAN} sx={{ p: 0, border: isExpanded ? undefined : 'none' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <DiffViewer
                                oldValue={row.rawOldValue}
                                newValue={row.rawNewValue}
                                requestUri={row.requestUri}
                                durationMs={row.durationMs}
                                outcome={row.outcome}
                                errorMessage={row.errorMessage}
                              />
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}

                  {!loading && trailRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={TRAIL_COL_SPAN} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalTrail}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50, 100]}
            />
          </Paper>
        </>
      )}

      <AuditDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={handleSaveAudit} />
    </Box>
  );
};

export default AuditPage;
