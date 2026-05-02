import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, Avatar, Stack, Collapse, CircularProgress,
  Alert, Snackbar, FormControlLabel, Switch,
} from '@mui/material';
import {
  Add            as AddIcon,
  Search         as SearchIcon,
  Refresh        as RefreshIcon,
  Download       as DownloadIcon,
  Login          as LoginIcon,
  Logout         as LogoutIcon,
  Edit           as EditIcon,
  Block          as DisableIcon,
  Visibility     as ViewIcon,
  CloudUpload    as UploadIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp   as ExpandLessIcon,
  CompareArrows  as CompareIcon,
  PlayArrow      as StartIcon,
  CheckCircle    as CompleteIcon,
  Cancel         as CancelIcon,
  Warning        as OverdueIcon,
} from '@mui/icons-material';
import PageHeader  from '../../components/PageHeader';
import ErrorAlert  from '../../components/ErrorAlert';
import { formatDate } from '../../utils/helpers';
import { ROUTES }  from '../../utils/constants';
import {
  searchAuditLogsApi,
  getAuditStatsApi,
  getQmsAuditsApi,
  createQmsAuditApi,
  updateQmsAuditApi,
  startQmsAuditApi,
  completeQmsAuditApi,
  cancelQmsAuditApi,
  deleteQmsAuditApi,
} from '../../api/auditApi';

// ── Constants ──────────────────────────────────────────────────────────────
const AUDIT_TYPES = ['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'REGULATORY'];

const AUDIT_STATUS_META = {
  PLANNED:     { label: 'Planned',     color: 'default'  },
  IN_PROGRESS: { label: 'In Progress', color: 'info'     },
  COMPLETED:   { label: 'Completed',   color: 'success'  },
  CANCELLED:   { label: 'Cancelled',   color: 'error'    },
};

const KNOWN_MODULES = [
  { value: 'ALL',              label: 'All Modules'              },
  { value: 'AUTH',             label: 'AUTH — Login / Logout'    },
  { value: 'USER',             label: 'USER — Users'             },
  { value: 'ROLE',             label: 'ROLE — Roles'             },
  { value: 'PERMISSION',       label: 'PERMISSION'               },
  { value: 'CAPA',             label: 'CAPA'                     },
  { value: 'DEVIATION',        label: 'DEVIATION'                },
  { value: 'INCIDENT',         label: 'INCIDENT'                 },
  { value: 'CHANGE_CONTROL',   label: 'CHANGE_CONTROL'           },
  { value: 'MARKET_COMPLAINT', label: 'MARKET_COMPLAINT'         },
  { value: 'DOCUMENT',         label: 'DOCUMENT — DMS'           },
  { value: 'COURSE',           label: 'COURSE'                   },
  { value: 'TRAINING',         label: 'TRAINING — LMS'           },
  { value: 'REPORT',           label: 'REPORT'                   },
  { value: 'PASSWORD_POLICY',  label: 'PASSWORD_POLICY'          },
  { value: 'SYSTEM',           label: 'SYSTEM'                   },
];

const KNOWN_ACTIONS = [
  'ALL', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE',
  'VIEW', 'UPLOAD', 'DOWNLOAD', 'APPROVE', 'REJECT', 'SYSTEM_EVENT',
];

// ── Helpers ────────────────────────────────────────────────────────────────
const ACTION_ICON = {
  LOGIN: <LoginIcon fontSize="small" />,
  LOGOUT: <LogoutIcon fontSize="small" />,
  VIEW: <ViewIcon fontSize="small" />,
  READ: <ViewIcon fontSize="small" />,
  CREATE: <AddIcon fontSize="small" />,
  UPDATE: <EditIcon fontSize="small" />,
  UPLOAD: <UploadIcon fontSize="small" />,
  DELETE: <DisableIcon fontSize="small" />,
  DOWNLOAD: <DownloadIcon fontSize="small" />,
};

const ACTION_COLOR = {
  info: '#1565C0', success: '#2E7D32', warning: '#E65100', error: '#C62828',
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

  const STATUS_BG    = { changed: '#FFF8E1', added: '#E8F5E9', removed: '#FFEBEE' };
  const STATUS_LABEL = { changed: 'CHANGED', added: 'ADDED', removed: 'REMOVED' };
  const STATUS_COLOR_MAP = { changed: 'warning', added: 'success', removed: 'error' };

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
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
                        <Typography variant="caption" fontFamily="monospace"
                          sx={{ color: 'error.dark', wordBreak: 'break-all', display: 'block' }}>
                          {truncate(oldStr) || <span style={{ color: '#999' }}>—</span>}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace"
                          sx={{ color: 'success.dark', wordBreak: 'break-all', display: 'block' }}>
                          {truncate(newStr) || <span style={{ color: '#999' }}>—</span>}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={STATUS_LABEL[status]} size="small"
                          color={STATUS_COLOR_MAP[status]} sx={{ fontSize: 9, height: 18 }} />
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

// ── Schedule / Edit Audit Dialog ───────────────────────────────────────────
const EMPTY_FORM = {
  title: '', auditType: 'INTERNAL', scope: '',
  leadAuditorName: '', leadAuditorId: '', scheduledDate: '', objectives: '',
};

const AuditDialog = ({ open, onClose, onSaved, editAudit }) => {
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const isEdit = !!editAudit;

  useEffect(() => {
    if (open) {
      setErrors({});
      setError(null);
      setForm(
        isEdit
          ? {
              title:           editAudit.title              || '',
              auditType:       editAudit.auditType           || 'INTERNAL',
              scope:           editAudit.scope               || '',
              leadAuditorName: editAudit.leadAuditorName     || '',
              leadAuditorId:   editAudit.leadAuditorId != null ? String(editAudit.leadAuditorId) : '',
              scheduledDate:   editAudit.scheduledDate       || '',
              objectives:      editAudit.objectives          || '',
            }
          : EMPTY_FORM
      );
    }
  }, [open, isEdit, editAudit]);

  const validate = () => {
    const e = {};
    ['title', 'auditType', 'scope', 'leadAuditorName', 'scheduledDate'].forEach((k) => {
      if (!form[k]) e[k] = 'Required';
    });
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title:           form.title.trim(),
        auditType:       form.auditType,
        scope:           form.scope.trim(),
        leadAuditorName: form.leadAuditorName.trim(),
        leadAuditorId:   form.leadAuditorId ? Number(form.leadAuditorId) : undefined,
        scheduledDate:   form.scheduledDate,
        objectives:      form.objectives.trim() || undefined,
      };
      if (isEdit) {
        await updateQmsAuditApi(editAudit.id, payload);
      } else {
        await createQmsAuditApi(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? 'Edit Audit' : 'Schedule New Audit'}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField label="Audit Title" required fullWidth size="small"
              value={form.title} onChange={set('title')}
              error={!!errors.title} helperText={errors.title} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Audit Type" select required fullWidth size="small"
              value={form.auditType} onChange={set('auditType')}
              error={!!errors.auditType} helperText={errors.auditType}>
              {AUDIT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Scheduled Date" type="date" required fullWidth size="small"
              InputLabelProps={{ shrink: true }}
              value={form.scheduledDate} onChange={set('scheduledDate')}
              error={!!errors.scheduledDate} helperText={errors.scheduledDate} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Scope / Area" required fullWidth size="small"
              value={form.scope} onChange={set('scope')}
              error={!!errors.scope} helperText={errors.scope} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Lead Auditor Name" required fullWidth size="small"
              value={form.leadAuditorName} onChange={set('leadAuditorName')}
              error={!!errors.leadAuditorName} helperText={errors.leadAuditorName} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Lead Auditor ID (optional)" fullWidth size="small"
              type="number" inputProps={{ min: 1 }}
              value={form.leadAuditorId} onChange={set('leadAuditorId')}
              helperText="User ID of the auditor" />
          </Grid>
          <Grid item xs={6} /> {/* spacer */}
          <Grid item xs={12}>
            <TextField label="Objectives / Notes (optional)" fullWidth size="small"
              multiline rows={3}
              value={form.objectives} onChange={set('objectives')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule Audit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Complete Audit Dialog (captures findings + observations) ───────────────
const CompleteDialog = ({ open, onClose, onConfirm, audit, busy }) => {
  const [findings,     setFindings]     = useState('');
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (open) {
      setFindings(audit?.findings != null ? String(audit.findings) : '');
      setObservations(audit?.observations != null ? String(audit.observations) : '');
    }
  }, [open, audit]);

  const handleConfirm = () => {
    onConfirm({
      findings:     findings     !== '' ? Number(findings)     : undefined,
      observations: observations !== '' ? Number(observations) : undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Complete Audit</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Record the number of findings and observations before closing this audit.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField label="Findings" fullWidth size="small" type="number"
              inputProps={{ min: 0 }}
              value={findings} onChange={(e) => setFindings(e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Observations" fullWidth size="small" type="number"
              inputProps={{ min: 0 }}
              value={observations} onChange={(e) => setObservations(e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" color="success" onClick={handleConfirm} disabled={busy}
          startIcon={busy ? <CircularProgress size={16} /> : <CompleteIcon />}>
          {busy ? 'Completing…' : 'Mark Complete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const AuditPage = () => {
  const [tab, setTab] = useState(0);

  // ── Audit Schedule state ────────────────────────────────────────────────
  const [auditRows,    setAuditRows]    = useState([]);
  const [auditTotal,   setAuditTotal]   = useState(0);
  const [auditPage,    setAuditPage]    = useState(0);
  const [auditRpp,     setAuditRpp]     = useState(15);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError,   setAuditError]   = useState(null);
  const [auditSearch,  setAuditSearch]  = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [actionBusy,     setActionBusy]     = useState({});
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [editAudit,      setEditAudit]      = useState(null);
  const [completeOpen,   setCompleteOpen]   = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [includeDisabled, setIncludeDisabled] = useState(false);

  // ── Activity Trail state ────────────────────────────────────────────────
  const [trailRows,     setTrailRows]     = useState([]);
  const [totalTrail,    setTotalTrail]    = useState(0);
  const [trailLoading,  setTrailLoading]  = useState(false);
  const [trailError,    setTrailError]    = useState(null);
  const [trailSearch,   setTrailSearch]   = useState('');
  const [moduleFilter,  setModuleFilter]  = useState('ALL');
  const [actionFilter,  setActionFilter]  = useState('ALL');
  const [trailPage,     setTrailPage]     = useState(0);
  const [trailRpp,      setTrailRpp]      = useState(15);
  const [stats,         setStats]         = useState(null);
  const [expandedRows,  setExpandedRows]  = useState(new Set());

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity });

  const setBusy = (id, busy) =>
    setActionBusy((prev) => ({ ...prev, [id]: busy }));

  // ── Fetch audit schedule ────────────────────────────────────────────────
  const fetchAudits = useCallback(async (pg = auditPage, rpp = auditRpp) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = {
        page: pg,
        size: rpp,
        ...(auditSearch  && { search:    auditSearch }),
        ...(statusFilter && { status:    statusFilter }),
        ...(typeFilter   && { type:      typeFilter }),
        ...(dateFrom     && { from:      dateFrom }),
        ...(dateTo       && { to:        dateTo }),
      };
      const res = await getQmsAuditsApi(params);
      const payload = res.data?.data;
      const items   = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setAuditRows(includeDisabled ? items : items.filter((a) => !a.disabled));
      setAuditTotal(payload?.totalElements ?? items.length);
    } catch (err) {
      setAuditError(err.response?.data?.message || 'Failed to load audits.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditRpp, auditSearch, statusFilter, typeFilter, dateFrom, dateTo, includeDisabled]);

  // ── Fetch activity trail ────────────────────────────────────────────────
  const fetchTrail = useCallback(async () => {
    setTrailLoading(true);
    setTrailError(null);
    setExpandedRows(new Set());
    try {
      const params = {
        page:       trailPage,
        size:       trailRpp,
        ...(trailSearch                  && { username: trailSearch }),
        ...(moduleFilter !== 'ALL'       && { module:   moduleFilter }),
        ...(actionFilter !== 'ALL'       && { action:   actionFilter }),
      };
      const { data } = await searchAuditLogsApi(params);
      const payload = data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setTrailRows(items.map(normTrailRow));
      setTotalTrail(payload?.totalElements ?? items.length);
    } catch (err) {
      setTrailError(err.response?.data?.message || 'Failed to load audit trail.');
    } finally {
      setTrailLoading(false);
    }
  }, [trailSearch, moduleFilter, actionFilter, trailPage, trailRpp]);

  useEffect(() => {
    if (tab === 0) fetchAudits(auditPage, auditRpp);
  }, [tab, auditPage, auditRpp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 0 when filters change
  useEffect(() => {
    setAuditPage(0);
    fetchAudits(0, auditRpp);
  }, [auditSearch, statusFilter, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 1) fetchTrail();
  }, [tab, fetchTrail]);

  useEffect(() => {
    getAuditStatsApi().then(({ data }) => setStats(data?.data || null)).catch(() => {});
  }, []);

  const toggleExpand = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Audit lifecycle actions ─────────────────────────────────────────────
  const handleStart = async (audit) => {
    setBusy(audit.id, true);
    try {
      await startQmsAuditApi(audit.id);
      showToast('Audit started — now In Progress.');
      fetchAudits(auditPage, auditRpp);
    } catch (err) {
      showToast(err.response?.data?.message || 'Start failed.', 'error');
    } finally { setBusy(audit.id, false); }
  };

  const openComplete = (audit) => { setCompleteTarget(audit); setCompleteOpen(true); };

  const handleComplete = async ({ findings, observations }) => {
    if (!completeTarget) return;
    const id = completeTarget.id;
    setBusy(id, true);
    try {
      const params = {};
      if (findings     != null) params.findings     = findings;
      if (observations != null) params.observations = observations;
      await completeQmsAuditApi(id, params);
      showToast('Audit marked as Completed.');
      setCompleteOpen(false);
      setCompleteTarget(null);
      fetchAudits(auditPage, auditRpp);
    } catch (err) {
      showToast(err.response?.data?.message || 'Complete failed.', 'error');
    } finally { setBusy(id, false); }
  };

  const handleCancel = async (audit) => {
    if (!window.confirm(`Cancel audit "${audit.title}"?`)) return;
    setBusy(audit.id, true);
    try {
      await cancelQmsAuditApi(audit.id);
      showToast('Audit cancelled.', 'warning');
      fetchAudits(auditPage, auditRpp);
    } catch (err) {
      showToast(err.response?.data?.message || 'Cancel failed.', 'error');
    } finally { setBusy(audit.id, false); }
  };

  const handleDelete = async (audit) => {
    if (!window.confirm(`Disable audit "${audit.title}"?`)) return;
    setBusy(audit.id, true);
    try {
      await deleteQmsAuditApi(audit.id);
      showToast('Audit disabled.');
      fetchAudits(auditPage, auditRpp);
    } catch (err) {
      showToast(err.response?.data?.message || 'Disable failed.', 'error');
    } finally { setBusy(audit.id, false); }
  };

  const openEdit = (audit) => { setEditAudit(audit); setDialogOpen(true); };

  const onSaved = () => {
    showToast(editAudit ? 'Audit updated.' : 'Audit scheduled successfully.');
    fetchAudits(0, auditRpp);
    setAuditPage(0);
  };

  // ── Summary cards (derived from real data + stats) ──────────────────────
  const summaryCards = [
    { label: 'Total Audits',   value: auditTotal,                                                color: 'primary.main'   },
    { label: 'Completed',      value: auditRows.filter((a) => a.status === 'COMPLETED').length,   color: 'success.main'   },
    { label: 'In Progress',    value: auditRows.filter((a) => a.status === 'IN_PROGRESS').length, color: 'info.main'      },
    { label: 'Planned',        value: auditRows.filter((a) => a.status === 'PLANNED').length,     color: 'warning.main'   },
    { label: 'Total Actions',  value: stats?.totalEvents  ?? totalTrail,                         color: 'secondary.main' },
    { label: 'Failed Logins',  value: stats?.loginFailures  ?? '—',                                color: 'error.main'     },
  ];

  const formatTimestamp = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-US', {
      year:     'numeric',
      month:    'short',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const TRAIL_COL_SPAN = 11;

  return (
    <Box>
      <PageHeader
        title="Audit Management"
        subtitle="Schedule audits and track every user action across the system."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Audit' }]}
        action={
          tab === 0 && (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => { setEditAudit(null); setDialogOpen(true); }}>
              Schedule Audit
            </Button>
          )
        }
      />

      {/* ── Summary Cards ── */}
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
        <Tabs value={tab} onChange={(_, v) => {
          setTab(v); setAuditSearch(''); setTrailSearch(''); setAuditPage(0); setTrailPage(0);
        }}>
          <Tab label="Audit Schedule" />
          <Tab label="User Activity Trail" />
        </Tabs>
      </Box>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 0: AUDIT SCHEDULE
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 0 && (
        <>
          {/* Filter bar */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search audits…"
              size="small" value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              sx={{ width: 240 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="Status" select size="small" sx={{ minWidth: 130 }}
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              {Object.entries(AUDIT_STATUS_META).map(([v, m]) => (
                <MenuItem key={v} value={v}>{m.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Type" select size="small" sx={{ minWidth: 130 }}
              value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">All Types</MenuItem>
              {AUDIT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="From" type="date" size="small"
              InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
              value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            />
            <TextField
              label="To" type="date" size="small"
              InputLabelProps={{ shrink: true }} sx={{ width: 150 }}
              value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={() => fetchAudits(auditPage, auditRpp)} disabled={auditLoading}>
                {auditLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={includeDisabled}
                  onChange={(e) => { setIncludeDisabled(e.target.checked); setAuditPage(0); }}
                />
              }
              label="Include Disabled"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
              {auditTotal} audit{auditTotal !== 1 ? 's' : ''}
            </Typography>
          </Stack>

          {auditError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAuditError(null)}>
              {auditError}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Audit #', 'Title', 'Type', 'Scope', 'Lead Auditor', 'Scheduled', 'Completed', 'Findings', 'Observations', 'Status', 'Actions'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 600, bgcolor: 'grey.50', whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 11 }).map((__, j) => (
                            <TableCell key={j}><Box sx={{ height: 14, bgcolor: 'grey.100', borderRadius: 0.5 }} /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : auditRows.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                            No audits found. Click "Schedule Audit" to add one.
                          </TableCell>
                        </TableRow>
                      )
                    : auditRows.map((row) => {
                        const busy   = !!actionBusy[row.id];
                        const meta   = AUDIT_STATUS_META[row.status] || { label: row.status, color: 'default' };
                        const canStart    = row.status === 'PLANNED';
                        const canComplete = ['PLANNED', 'IN_PROGRESS'].includes(row.status);
                        const canCancel   = ['PLANNED', 'IN_PROGRESS'].includes(row.status);
                        return (
                          <TableRow key={row.id} hover sx={{ opacity: row.disabled ? 0.55 : 1 }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} color="primary.main" noWrap>
                                {row.recordNumber || `#${row.id}`}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Typography variant="body2" noWrap title={row.title}>{row.title}</Typography>
                              {row.disabled && (
                                <Chip label="Disabled" size="small" color="default" variant="outlined"
                                  sx={{ fontSize: '0.6rem', height: 16, mt: 0.25 }} />
                              )}
                              {!row.disabled && row.overdue && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                  <OverdueIcon sx={{ fontSize: 12, color: 'error.main' }} />
                                  <Typography variant="caption" color="error.main">Overdue</Typography>
                                </Box>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip label={row.auditType} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 140 }}>
                              <Typography variant="caption" noWrap>{row.scope}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" noWrap>{row.leadAuditorName || '—'}</Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Typography variant="caption">{formatDate(row.scheduledDate)}</Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {row.completedDate
                                ? <Typography variant="caption">{formatDate(row.completedDate)}</Typography>
                                : <Typography variant="caption" color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={row.findings ?? 0} size="small"
                                color={(row.findings ?? 0) > 0 ? 'error' : 'default'} />
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={row.observations ?? 0} size="small"
                                color={(row.observations ?? 0) > 0 ? 'warning' : 'default'} />
                            </TableCell>
                            <TableCell>
                              <Chip label={meta.label} size="small" color={meta.color} />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', gap: 0.25 }}>
                                {/* Edit */}
                                {canCancel && (
                                  <Tooltip title="Edit">
                                    <IconButton size="small" disabled={busy} onClick={() => openEdit(row)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* Start */}
                                {canStart && (
                                  <Tooltip title="Start Audit">
                                    <IconButton size="small" color="info" disabled={busy}
                                      onClick={() => handleStart(row)}>
                                      {busy ? <CircularProgress size={14} /> : <StartIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* Complete */}
                                {canComplete && (
                                  <Tooltip title="Mark Complete">
                                    <IconButton size="small" color="success" disabled={busy}
                                      onClick={() => openComplete(row)}>
                                      {busy ? <CircularProgress size={14} /> : <CompleteIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* Cancel */}
                                {canCancel && (
                                  <Tooltip title="Cancel Audit">
                                    <IconButton size="small" color="warning" disabled={busy}
                                      onClick={() => handleCancel(row)}>
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* Disable */}
                                <Tooltip title={row.disabled ? 'Already Disabled' : 'Disable'}>
                                  <span>
                                    <IconButton size="small" color="error"
                                      disabled={busy || row.disabled}
                                      onClick={() => handleDelete(row)}>
                                      <DisableIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={auditTotal}
              page={auditPage}
              rowsPerPage={auditRpp}
              onPageChange={(_, p) => setAuditPage(p)}
              onRowsPerPageChange={(e) => { setAuditRpp(+e.target.value); setAuditPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50]}
            />
          </Paper>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: USER ACTIVITY TRAIL
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 1 && (
        <>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search username…"
              size="small" value={trailSearch}
              onChange={(e) => { setTrailSearch(e.target.value); setTrailPage(0); }}
              sx={{ width: 240 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="Module" select size="small" sx={{ minWidth: 200 }}
              value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setTrailPage(0); }}
            >
              {KNOWN_MODULES.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Action" select size="small" sx={{ minWidth: 150 }}
              value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setTrailPage(0); }}
            >
              {KNOWN_ACTIONS.map((a) => (
                <MenuItem key={a} value={a}>{a.replace(/_/g, ' ')}</MenuItem>
              ))}
            </TextField>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchTrail} disabled={trailLoading}>
                {trailLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Trail">
              <IconButton color="primary"><DownloadIcon /></IconButton>
            </Tooltip>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {totalTrail} total records · {expandedRows.size > 0 ? `${expandedRows.size} expanded` : 'Click ▶ to expand a row and view change details'}
          </Typography>

          {trailError && <ErrorAlert message={trailError} onRetry={fetchTrail} />}

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
                    const isExpanded  = expandedRows.has(row.id);
                    const hasDiffData = row.rawOldValue || row.rawNewValue;
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow hover sx={{ bgcolor: isExpanded ? 'primary.50' : 'inherit' }}>
                          <TableCell sx={{ p: 0.5, width: 36 }}>
                            <Tooltip title={isExpanded ? 'Collapse' : 'Expand details'}>
                              <IconButton size="small" onClick={() => toggleExpand(row.id)}
                                sx={{ opacity: hasDiffData || row.requestUri !== '-' ? 1 : 0.3 }}>
                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.disabled">
                              {trailPage * trailRpp + idx + 1}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="caption" fontFamily="monospace">
                              {formatTimestamp(row.timestamp)}
                            </Typography>
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
                            {row.role !== '—'
                              ? <Chip label={row.role} size="small" variant="outlined"
                                  color={row.role === 'SUPER_ADMIN' ? 'error' : row.role === 'ADMIN' ? 'primary' : row.role === 'MANAGER' ? 'secondary' : 'default'}
                                  sx={{ fontSize: 10 }} />
                              : <Typography variant="caption" color="text.disabled">—</Typography>}
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
                                  color:   ACTION_COLOR[row.severity],
                                  border:  `1px solid ${ACTION_COLOR[row.severity]}40`,
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={row.module} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="caption">{row.description}</Typography>
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

                  {!trailLoading && trailRows.length === 0 && (
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
              page={trailPage}
              rowsPerPage={trailRpp}
              onPageChange={(_, p) => setTrailPage(p)}
              onRowsPerPageChange={(e) => { setTrailRpp(+e.target.value); setTrailPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50, 100]}
            />
          </Paper>
        </>
      )}

      {/* ── Schedule / Edit Dialog ── */}
      <AuditDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditAudit(null); }}
        onSaved={onSaved}
        editAudit={editAudit}
      />

      {/* ── Complete Dialog (findings + observations) ── */}
      <CompleteDialog
        open={completeOpen}
        onClose={() => { setCompleteOpen(false); setCompleteTarget(null); }}
        onConfirm={handleComplete}
        audit={completeTarget}
        busy={completeTarget ? !!actionBusy[completeTarget.id] : false}
      />

      {/* ── Toast ── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AuditPage;
