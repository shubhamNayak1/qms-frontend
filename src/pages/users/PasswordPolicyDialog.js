import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Box, Typography, Grid, TextField,
  IconButton, Tooltip, Chip, Alert, Divider, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Paper,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  Edit as EditIcon,
  Block as DisableIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as ActiveIcon,
} from '@mui/icons-material';
import {
  getActivePolicyApi,
  getAllPoliciesApi,
  createPolicyApi,
  updatePolicyApi,
  deletePolicyApi,
} from '../../api/passwordPolicyApi';
import { searchAuditLogsApi } from '../../api/auditApi';
import { useAuth } from '../../store/AuthContext';
import { formatDate, formatDateTime } from '../../utils/helpers';
import useESignGuard from '../../hooks/useESignGuard';

const EMPTY_POLICY = {
  passwordLengthMin: 8,
  passwordLengthMax: 128,
  alphaMin: 1,
  numericMin: 1,
  specialCharMin: 1,
  upperCaseMin: 1,
  numberOfLoginAttempts: 5,
  validPeriod: 90,
  previousPasswordAttemptTrack: 5,
  effectiveDate: new Date().toISOString().split('T')[0],
};

const FIELD_META = [
  { key: 'passwordLengthMin',         label: 'Min Password Length',          type: 'number', xs: 6 },
  { key: 'passwordLengthMax',         label: 'Max Password Length',          type: 'number', xs: 6 },
  { key: 'alphaMin',                  label: 'Min Alphabetic Chars',         type: 'number', xs: 6 },
  { key: 'upperCaseMin',              label: 'Min Uppercase Chars',          type: 'number', xs: 6 },
  { key: 'numericMin',                label: 'Min Numeric Chars',            type: 'number', xs: 6 },
  { key: 'specialCharMin',            label: 'Min Special Chars',            type: 'number', xs: 6 },
  { key: 'numberOfLoginAttempts',     label: 'Max Login Attempts',           type: 'number', xs: 6 },
  { key: 'validPeriod',               label: 'Password Valid Period (days)', type: 'number', xs: 6 },
  { key: 'previousPasswordAttemptTrack', label: 'Password History Count',   type: 'number', xs: 6 },
  { key: 'effectiveDate',             label: 'Effective Date',               type: 'date',   xs: 6 },
];

// ── Small read-only policy card ──────────────────────────────────────────────
const PolicyCard = ({ policy }) => (
  <Grid container spacing={2}>
    {FIELD_META.map(({ key, label }) => (
      <Grid item xs={6} key={key}>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{policy[key] ?? '—'}</Typography>
      </Grid>
    ))}
  </Grid>
);

// ── Edit form ─────────────────────────────────────────────────────────────────
const PolicyForm = ({ value, onChange }) => (
  <Grid container spacing={2}>
    {FIELD_META.map(({ key, label, type, xs }) => (
      <Grid item xs={xs} key={key}>
        <TextField
          label={label}
          type={type}
          fullWidth
          size="small"
          value={value[key] ?? ''}
          onChange={(e) => onChange({ ...value, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
          InputLabelProps={type === 'date' ? { shrink: true } : {}}
        />
      </Grid>
    ))}
  </Grid>
);

// ── Tab panel helper ──────────────────────────────────────────────────────────
const TabPanel = ({ value, index, children }) =>
  value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;

// ══════════════════════════════════════════════════════════════════════════════
const PasswordPolicyDialog = ({ open, onClose }) => {
  const { isSuperAdmin, hasRole } = useAuth();
  const canViewAll  = isSuperAdmin || hasRole('QA_MANAGER') || hasRole('ADMIN');
  const canEdit     = isSuperAdmin || hasRole('ADMIN');
  const esign       = useESignGuard();

  const [tab, setTab] = useState(0);

  // Active policy tab state
  const [activePolicy, setActivePolicy]   = useState(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError]     = useState(null);
  const [editMode, setEditMode]           = useState(false);
  const [editForm, setEditForm]           = useState(EMPTY_POLICY);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState(null);
  const [saveSuccess, setSaveSuccess]     = useState(false);

  // All policies tab state
  const [policies, setPolicies]           = useState([]);
  const [listLoading, setListLoading]     = useState(false);
  const [listError, setListError]         = useState(null);
  const [createMode, setCreateMode]       = useState(false);
  const [createForm, setCreateForm]       = useState(EMPTY_POLICY);
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState(null);
  const [includeDisabled, setIncludeDisabled] = useState(false);

  // Audit trail (true change history — pulled from audit_logs so edits
  // against the single policy row are preserved as a timeline).
  const [auditLogs, setAuditLogs]           = useState([]);
  const [auditLoading, setAuditLoading]     = useState(false);
  const [auditError, setAuditError]         = useState(null);

  // ── Load active policy ───────────────────────────────────────────────────
  const fetchActive = useCallback(() => {
    setActiveLoading(true);
    setActiveError(null);
    getActivePolicyApi()
      .then(({ data }) => setActivePolicy(data?.data || null))
      .catch(() => setActiveError('Failed to load active policy.'))
      .finally(() => setActiveLoading(false));
  }, []);

  // ── Load all policies ────────────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    if (!canViewAll) return;
    setListLoading(true);
    setListError(null);
    getAllPoliciesApi()
      .then(({ data }) => {
        const list = data?.data ?? [];
        setPolicies(Array.isArray(list) ? list : list.content ?? []);
      })
      .catch(() => setListError('Failed to load policies.'))
      .finally(() => setListLoading(false));
  }, [canViewAll]);

  // ── Load audit trail for PasswordPolicy ───────────────────────────────────
  const fetchAuditLogs = useCallback(() => {
    if (!canViewAll) return;
    setAuditLoading(true);
    setAuditError(null);
    searchAuditLogsApi({
      module: 'PASSWORD_POLICY',
      entityType: 'PasswordPolicy',
      size: 50,
    })
      .then(({ data }) => {
        const content = data?.data?.content ?? data?.data ?? [];
        setAuditLogs(Array.isArray(content) ? content : []);
      })
      .catch(() => setAuditError('Failed to load change history.'))
      .finally(() => setAuditLoading(false));
  }, [canViewAll]);

  useEffect(() => {
    if (open) {
      fetchActive();
      fetchAll();
      fetchAuditLogs();
      setTab(0);
      setEditMode(false);
      setSaveSuccess(false);
      setSaveError(null);
      setCreateMode(false);
      setCreateError(null);
    }
  }, [open, fetchActive, fetchAll, fetchAuditLogs]);

  // ── Save edited active policy ────────────────────────────────────────────
  // 21 CFR Part 11 — password-policy edit is a destructive admin action,
  // so the actor re-signs before the PUT fires. useESignGuard handles the
  // password prompt + /auth/e-sign call; the inner action runs only on
  // successful signature.
  const handleSave = () => {
    if (!activePolicy?.id) return;
    setSaveError(null);
    esign.request({
      meaning: 'Update password policy',
      recordRef: `Policy #${activePolicy.id}`,
      action: async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
          const { data } = await updatePolicyApi(activePolicy.id, editForm);
          setActivePolicy(data?.data || editForm);
          setEditMode(false);
          setSaveSuccess(true);
          fetchAll(); fetchAuditLogs();
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // ── Create new policy ────────────────────────────────────────────────────
  const handleCreate = () => {
    setCreateError(null);
    esign.request({
      meaning: 'Create password policy',
      recordRef: `Effective ${createForm?.effectiveDate || 'TBD'}`,
      action: async () => {
        setCreating(true);
        try {
          await createPolicyApi(createForm);
          setCreateMode(false);
          setCreateForm(EMPTY_POLICY);
          fetchAll(); fetchAuditLogs();
          fetchActive();
        } finally {
          setCreating(false);
        }
      },
    });
  };

  // ── Disable policy ───────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Disable this password policy?')) return;
    try {
      await deletePolicyApi(id);
      fetchAll(); fetchAuditLogs();
      fetchActive();
    } catch (err) {
      setListError(err.response?.data?.message || 'Failed to disable policy.');
    }
  };

  // ── Enter edit mode ──────────────────────────────────────────────────────
  const startEdit = () => {
    if (!activePolicy) return;
    const { id, createdAt, updatedAt, createdBy, active, ...rest } = activePolicy; // eslint-disable-line no-unused-vars
    setEditForm({ ...EMPTY_POLICY, ...rest });
    setSaveError(null);
    setSaveSuccess(false);
    setEditMode(true);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Password Policy</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Active Policy" />
        {canViewAll && <Tab label="History" />}
      </Tabs>

      <DialogContent sx={{ pt: 2, minHeight: 340 }}>

        {/* ── TAB 0: Active Policy ── */}
        <TabPanel value={tab} index={0}>
          {activeLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>}
          {activeError && <Alert severity="error">{activeError}</Alert>}
          {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>Policy updated successfully.</Alert>}
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

          {!activeLoading && !activePolicy && !activeError && (
            <Alert severity="info">No active policy found.</Alert>
          )}

          {activePolicy && !editMode && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ActiveIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Currently Active Policy
                  </Typography>
                  <Chip label="ACTIVE" size="small" color="success" />
                </Box>
                {canEdit && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={startEdit}
                  >
                    Edit
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <PolicyCard policy={activePolicy} />
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Effective: <strong>{formatDate(activePolicy.effectiveDate)}</strong>
                  {activePolicy.createdBy && <> · Created by: <strong>{activePolicy.createdBy}</strong></>}
                  {activePolicy.updatedAt && <> · Last updated: <strong>{formatDate(activePolicy.updatedAt)}</strong></>}
                </Typography>
              </Box>
            </>
          )}

          {activePolicy && editMode && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Edit Active Policy</Typography>
                <Button size="small" color="inherit" onClick={() => setEditMode(false)}>Cancel</Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <PolicyForm value={editForm} onChange={setEditForm} />
            </>
          )}
        </TabPanel>

        {/* ── TAB 1: History ── */}
        {canViewAll && (
          <TabPanel value={tab} index={1}>
            {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}
            {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

            {/* Create new policy form */}
            {createMode ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600}>New Password Policy</Typography>
                  <Button size="small" color="inherit" onClick={() => { setCreateMode(false); setCreateError(null); }}>Cancel</Button>
                </Box>
                <PolicyForm value={createForm} onChange={setCreateForm} />
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? 'Creating…' : 'Create Policy'}
                  </Button>
                </Box>
              </>
            ) : (
              <>
                {/* ── Change log (true audit history) ──────────────────────── */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Change History
                  </Typography>
                  {auditError && <Alert severity="error" sx={{ mb: 1 }}>{auditError}</Alert>}
                  {auditLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : auditLogs.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No changes recorded yet.
                    </Typography>
                  ) : (
                    <Paper variant="outlined" sx={{ overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 600 }}>When</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {auditLogs.map((log) => (
                            <TableRow key={log.id} hover>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {formatDateTime(log.timestamp || log.eventTimestamp)}
                              </TableCell>
                              <TableCell>{log.userFullName || log.username || '—'}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={log.action}
                                  color={
                                    log.action === 'DELETE' ? 'error'
                                    : log.action === 'CREATE' ? 'success'
                                    : log.action === 'UPDATE' ? 'info'
                                    : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>
                                {log.description || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={includeDisabled}
                        onChange={(e) => setIncludeDisabled(e.target.checked)}
                      />
                    }
                    label="Include Disabled"
                  />
                  {canEdit && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => { setCreateForm(EMPTY_POLICY); setCreateMode(true); }}
                    >
                      New Policy
                    </Button>
                  )}
                </Box>

                {listLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
                ) : (
                  <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Effective Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Min Len</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Upper</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Numeric</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Special</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Attempts</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Valid (days)</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                          {canEdit && <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {policies.filter((p) => includeDisabled || !p.disabled).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              No policies found
                            </TableCell>
                          </TableRow>
                        )}
                        {policies.filter((p) => includeDisabled || !p.disabled).map((p) => (
                          <TableRow key={p.id} hover>
                            <TableCell>{formatDate(p.effectiveDate)}</TableCell>
                            <TableCell>{p.passwordLengthMin}</TableCell>
                            <TableCell>{p.upperCaseMin}</TableCell>
                            <TableCell>{p.numericMin}</TableCell>
                            <TableCell>{p.specialCharMin}</TableCell>
                            <TableCell>{p.numberOfLoginAttempts}</TableCell>
                            <TableCell>{p.validPeriod}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {p.active
                                  ? <Chip label="Active" size="small" color="success" />
                                  : <Chip label="Inactive" size="small" variant="outlined" />}
                                {p.disabled && <Chip label="Disabled" size="small" color="default" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
                              </Box>
                            </TableCell>
                            {canEdit && (
                              <TableCell align="right">
                                <Tooltip title="Disable">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDelete(p.id)}
                                    disabled={p.active || p.disabled}
                                  >
                                    <DisableIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </>
            )}
          </TabPanel>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {tab === 0 && editMode && (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        )}
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
      {esign.element}
    </Dialog>
  );
};

export default PasswordPolicyDialog;
