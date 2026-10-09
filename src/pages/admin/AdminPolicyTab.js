import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Alert, Chip, Stack, Table, TableHead,
  TableRow, TableCell, TableBody, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
} from '@mui/material';
import {
  LockReset as PasswordIcon,
  Schedule as TcdIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import PasswordPolicyDialog from '../users/PasswordPolicyDialog';
import { listTcdPolicyApi, updateTcdPolicyApi } from '../../api/tcdPolicyApi';
import useESignGuard from '../../hooks/useESignGuard';

/*
 * AdminPolicyTab — Policy tab for the unified /admin page.
 *
 * Two policy surfaces:
 *   1. Password Policy  → reuses the existing versioned editor dialog.
 *   2. TCD Policy       → inline per-module table of Target Closure Days
 *                          with an edit dialog per row.
 *
 * The TCD rows are seeded by V34 (one row per QMS module: CAPA /
 * DEVIATION / INCIDENT / MARKET_COMPLAINT / CHANGE_CONTROL). Each row
 * is editable here but no module service enforces it yet — Phase 2
 * wires each workflow service to read from this table instead of its
 * hard-coded constant.
 */

const MODULE_LABEL = {
  CAPA:             'CAPA',
  DEVIATION:        'Deviation',
  INCIDENT:         'Incident',
  MARKET_COMPLAINT: 'Market Complaint',
  CHANGE_CONTROL:   'Change Control',
};

const Section = ({ icon, title, subtitle, status, actions, children }) => (
  <Paper variant="outlined" sx={{ mb: 2 }}>
    <Box sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start', borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center',
        bgcolor: 'primary.light', color: 'primary.contrastText',
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          {status && <Chip label={status} size="small" color="success" variant="outlined" />}
        </Stack>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
      {actions}
    </Box>
    {children}
  </Paper>
);

const TcdEditDialog = ({ open, row, onClose, onSaved }) => {
  const [form, setForm] = useState(row || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const esign = useESignGuard();

  useEffect(() => { if (row) setForm(row); setError(null); }, [row]);

  // Pharma 21 CFR Part 11: a TCD-policy update is a destructive admin
  // action, so it goes through an e-sign re-prompt before the PUT fires.
  const save = () => {
    setError(null);
    esign.request({
      meaning: `Update TCD policy for ${MODULE_LABEL[row.moduleKey] || row.moduleKey}`,
      recordRef: row.moduleKey,
      action: async () => {
        setSaving(true);
        try {
          const { data } = await updateTcdPolicyApi(row.moduleKey, {
            maxDays:          Number(form.maxDays),
            warningDays:      Number(form.warningDays),
            extensionAllowed: !!form.extensionAllowed,
            maxExtensions:    Number(form.maxExtensions),
          });
          onSaved(data?.data || data);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (!row) return null;

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
      disableEscapeKeyDown
      maxWidth="xs" fullWidth
    >
      <DialogTitle>Edit {MODULE_LABEL[row.moduleKey] || row.moduleKey}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Max days to closure" type="number" required
                     helperText="Hard cap — days from Initiate to Close."
                     value={form.maxDays ?? ''} onChange={(e) => setForm({ ...form, maxDays: e.target.value })}
                     inputProps={{ min: 1, autoComplete: 'off' }} />
          <TextField label="Warning window (days)" type="number" required
                     helperText="Dashboard flips amber this many days before due date."
                     value={form.warningDays ?? ''} onChange={(e) => setForm({ ...form, warningDays: e.target.value })}
                     inputProps={{ min: 0, autoComplete: 'off' }} />
          <FormControlLabel
            control={<Switch
              checked={!!form.extensionAllowed}
              onChange={(e) => setForm({ ...form, extensionAllowed: e.target.checked })} />}
            label="Target-date extension allowed"
          />
          <TextField label="Max extensions per record" type="number" required
                     disabled={!form.extensionAllowed}
                     helperText="Hard cap on how many extensions one record may use."
                     value={form.maxExtensions ?? ''} onChange={(e) => setForm({ ...form, maxExtensions: e.target.value })}
                     inputProps={{ min: 0, autoComplete: 'off' }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving || esign.isPending}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || esign.isPending}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
      {esign.element}
    </Dialog>
  );
};

const AdminPolicyTab = () => {
  const [pwOpen, setPwOpen] = useState(false);

  const [tcdRows, setTcdRows]       = useState([]);
  const [tcdLoading, setTcdLoading] = useState(true);
  const [tcdError, setTcdError]     = useState(null);
  const [editing, setEditing]       = useState(null);

  const fetchTcd = async () => {
    setTcdLoading(true); setTcdError(null);
    try {
      const { data } = await listTcdPolicyApi();
      setTcdRows(data?.data || data || []);
    } catch (err) {
      setTcdError(err.response?.data?.message || 'Failed to load TCD policy.');
    } finally {
      setTcdLoading(false);
    }
  };

  useEffect(() => { fetchTcd(); }, []);

  const onSaved = (updated) => {
    setTcdRows((rs) => rs.map((r) => r.moduleKey === updated.moduleKey ? updated : r));
    setEditing(null);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1040, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Policies</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Tenant-wide rules enforced across every QMS workflow.
      </Typography>

      <Section
        icon={<PasswordIcon />}
        title="Password Policy"
        subtitle="Minimum length, character classes, expiry window, re-use lookback and lockout thresholds."
        status="Active"
        actions={
          <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setPwOpen(true)}>
            Edit
          </Button>
        }
      />

      <Section
        icon={<TcdIcon />}
        title="TCD Policy — Target Closure Days"
        subtitle="Per-module due-date config: max days, warning window and extension cap. One row per QMS module."
        status="Active"
        actions={
          <Tooltip title="Refresh"><IconButton size="small" onClick={fetchTcd}>
            <RefreshIcon fontSize="small" />
          </IconButton></Tooltip>
        }
      >
        {tcdLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : tcdError ? (
          <Box sx={{ p: 2 }}><Alert severity="error">{tcdError}</Alert></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary',
                                        bgcolor: 'action.hover', fontSize: 11,
                                        textTransform: 'uppercase', letterSpacing: 0.4 } }}>
                <TableCell>Module</TableCell>
                <TableCell align="right">Max days</TableCell>
                <TableCell align="right">Warning (days)</TableCell>
                <TableCell>Extensions</TableCell>
                <TableCell align="right">Max extensions</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {tcdRows.map((r) => (
                <TableRow key={r.moduleKey} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {MODULE_LABEL[r.moduleKey] || r.moduleKey}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={`${r.maxDays}d`} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={`${r.warningDays}d`} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.extensionAllowed ? 'Allowed' : 'Blocked'}
                      size="small"
                      color={r.extensionAllowed ? 'success' : 'default'}
                      variant={r.extensionAllowed ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {r.extensionAllowed ? r.maxExtensions : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditing(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {tcdRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No TCD rows seeded.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Section>

      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        <Typography variant="body2">
          Phase 1 stores the TCD config and surfaces it here. Phase 2 wires each workflow
          service to read from this table instead of its hard-coded due-date constant, so
          compliance can tune limits without a code deploy.
        </Typography>
      </Alert>

      <PasswordPolicyDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <TcdEditDialog open={!!editing} row={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
    </Box>
  );
};

export default AdminPolicyTab;
