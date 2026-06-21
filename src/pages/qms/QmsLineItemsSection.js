import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  listLineItemsApi, createLineItemApi, updateLineItemApi, deleteLineItemApi,
} from '../../api/qmsCommonApi';
import { formatDate } from '../../utils/helpers';

/**
 * QmsLineItemsSection — repeating "Existing System / Proposed System /
 * Justification" rows attached to a QMS record. Used uniformly by every
 * sub-module (the parent component passes the record's commonSlug).
 *
 * Props:
 *   commonSlug : kebab-case backend recordType (capa | deviation | …)
 *   recordId   : numeric record id
 *   readOnly   : if true, hides Add/Edit/Delete (e.g. for terminal records)
 */
const QmsLineItemsSection = ({ commonSlug, recordId, readOnly = false }) => {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [editing, setEditing]   = useState(null); // null = closed; {} = create; row = edit
  const [form, setForm]         = useState({
    existingSystem: '', proposedSystem: '', justification: '',
    proposedDate: '', status: '', remark: '',
  });
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetch = useCallback(async () => {
    if (!commonSlug || !recordId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await listLineItemsApi(commonSlug, recordId);
      setRows(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load line items.');
    } finally {
      setLoading(false);
    }
  }, [commonSlug, recordId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setEditing({});
    setForm({ existingSystem: '', proposedSystem: '', justification: '',
              proposedDate: '', status: '', remark: '' });
    setSaveError(null);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      existingSystem: row.existingSystem || '',
      proposedSystem: row.proposedSystem || '',
      justification:  row.justification  || '',
      proposedDate:   row.proposedDate   || '',
      status:         row.status         || '',
      remark:         row.remark         || '',
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const payload = {
        ...form,
        proposedDate: form.proposedDate || null,
        status:       form.status || null,
      };
      if (editing && editing.id) {
        await updateLineItemApi(commonSlug, recordId, editing.id, payload);
      } else {
        await createLineItemApi(commonSlug, recordId, payload);
      }
      setEditing(null);
      fetch();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save line item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove line item #${row.srNo}?`)) return;
    try {
      await deleteLineItemApi(commonSlug, recordId, row.id);
      fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                    letterSpacing={0.5} color="text.secondary" sx={{ flex: 1 }}>
          Changes Proposed with Justification
        </Typography>
        <Tooltip title="Refresh"><IconButton size="small" onClick={fetch}>
          <RefreshIcon fontSize="inherit" />
        </IconButton></Tooltip>
        {!readOnly && (
          <Button size="small" startIcon={<AddIcon />} onClick={openCreate} sx={{ ml: 1 }}>
            Add row
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No line items yet.{!readOnly && ' Use "Add row" to capture the first one.'}
        </Typography>
      ) : (
        <Box sx={{ overflow: 'auto', border: '1px solid', borderColor: 'divider',
                   borderRadius: 1.5 }}>
          <Box component="table" sx={{
              width: '100%', borderCollapse: 'collapse', fontSize: 13,
              '& th, & td': { px: 1, py: 0.6, borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'top' },
              '& th': { textAlign: 'left', fontWeight: 700, color: 'text.secondary',
                        bgcolor: 'action.hover', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
            }}>
            <thead>
              {/* Round-2 B2: Status column removed — testers found the
                  PENDING/IN_PROGRESS/COMPLETED chip on every row noisy and
                  potentially misleading (the line-item status is independent
                  of the record-level workflow status). Each edit is still
                  written to the audit_log via the @Audited annotation on
                  updateLineItem so the change history is preserved. */}
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Existing System</th>
                <th>Proposed System</th>
                <th>Justification</th>
                <th style={{ width: 100 }}>Proposed By</th>
                <th style={{ width: 100 }}>Date</th>
                {!readOnly && <th style={{ width: 70 }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.srNo}</td>
                  <td>{r.existingSystem || <em style={{ opacity: 0.5 }}>—</em>}</td>
                  <td>{r.proposedSystem || <em style={{ opacity: 0.5 }}>—</em>}</td>
                  <td>{r.justification  || <em style={{ opacity: 0.5 }}>—</em>}</td>
                  <td>{r.proposedByName || <em style={{ opacity: 0.5 }}>—</em>}</td>
                  <td>{formatDate(r.proposedDate)}</td>
                  {!readOnly && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(r)}>
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(r)}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton></Tooltip>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleSave(); } }}>
        <DialogTitle>{editing?.id ? `Edit line item #${editing.srNo}` : 'Add line item'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Existing System" multiline rows={2} fullWidth
                         value={form.existingSystem}
                         onChange={(e) => setForm({ ...form, existingSystem: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Proposed System" multiline rows={2} fullWidth
                         value={form.proposedSystem}
                         onChange={(e) => setForm({ ...form, proposedSystem: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Remark / Justification" multiline rows={2} fullWidth
                         value={form.justification}
                         onChange={(e) => setForm({ ...form, justification: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Proposed Date" type="date" fullWidth
                         InputLabelProps={{ shrink: true }}
                         value={form.proposedDate}
                         onChange={(e) => setForm({ ...form, proposedDate: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            {/* Round-2 B2: Status removed from the edit form. The
                verification-phase status lives on the parent record's
                workflow now (PENDING_VERIFICATION + line-item-specific
                verification fields), not on the line items themselves. */}
            <Grid item xs={12}>
              <TextField label="Remark" multiline rows={2} fullWidth
                         value={form.remark}
                         onChange={(e) => setForm({ ...form, remark: e.target.value })}
                         helperText="Captured to the audit_log on save."
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QmsLineItemsSection;
