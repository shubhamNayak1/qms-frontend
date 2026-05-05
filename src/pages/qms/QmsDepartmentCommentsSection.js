import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  listDeptCommentsApi, requestDeptCommentApi, fillDeptCommentApi,
} from '../../api/qmsCommonApi';
import { listDepartmentsApi } from '../../api/orgApi';
import { formatDateTime } from '../../utils/helpers';

/**
 * QmsDepartmentCommentsSection — fan-out comments per department.
 *
 *  - QA Reviewer / QA Head clicks "Request comment" → picks a department.
 *  - The HOD of that department later clicks "Fill comment" on the row.
 *
 * Backend rejects unauthorised actors; we just hide the buttons opportunistically.
 *
 * Props:
 *   commonSlug   : kebab-case backend recordType
 *   recordId     : numeric id of the QMS record
 *   currentUser  : optional — if provided we hide actions when clearly not
 *                  applicable (purely UX, server still enforces)
 */
const QmsDepartmentCommentsSection = ({ commonSlug, recordId, currentUser }) => {
  const [rows, setRows]               = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // Request-comment dialog
  const [reqOpen, setReqOpen]   = useState(false);
  const [reqDept, setReqDept]   = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqError, setReqError] = useState(null);

  // Fill-comment dialog
  const [fillRow, setFillRow]   = useState(null);
  const [fillText, setFillText] = useState('');
  const [fillSaving, setFillSaving] = useState(false);
  const [fillError, setFillError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!commonSlug || !recordId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await listDeptCommentsApi(commonSlug, recordId);
      setRows(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load department comments.');
    } finally {
      setLoading(false);
    }
  }, [commonSlug, recordId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    listDepartmentsApi()
      .then(({ data }) => setDepartments(data?.data || []))
      .catch(() => {});
  }, []);

  // Request comment
  const handleRequest = async () => {
    if (!reqDept) return;
    setReqSaving(true); setReqError(null);
    try {
      await requestDeptCommentApi(commonSlug, recordId, reqDept);
      setReqOpen(false); setReqDept('');
      fetch();
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to request comment.');
    } finally {
      setReqSaving(false);
    }
  };

  // Fill comment
  const openFill = (row) => {
    setFillRow(row);
    setFillText(row.comment || '');
    setFillError(null);
  };
  const handleFill = async () => {
    if (!fillRow || !fillText.trim()) return;
    setFillSaving(true); setFillError(null);
    try {
      await fillDeptCommentApi(commonSlug, recordId, fillRow.id, {
        departmentId: fillRow.departmentId,
        comment: fillText.trim(),
      });
      setFillRow(null);
      fetch();
    } catch (err) {
      setFillError(err.response?.data?.message || 'Failed to save comment.');
    } finally {
      setFillSaving(false);
    }
  };

  // Filter dropdown: don't show departments that already have a PENDING row.
  const pendingDeptIds = new Set(rows.filter(r => r.status === 'PENDING')
                                     .map(r => r.departmentId));

  // Heuristic: this user can probably FILL a row when the row's department
  // matches their own. Backend still authorises.
  const canFill = (row) =>
    !!currentUser?.departmentId && currentUser.departmentId === row.departmentId;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                    letterSpacing={0.5} color="text.secondary" sx={{ flex: 1 }}>
          Department-Wise Comments
        </Typography>
        <Tooltip title="Refresh"><IconButton size="small" onClick={fetch}>
          <RefreshIcon fontSize="inherit" />
        </IconButton></Tooltip>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setReqOpen(true)} sx={{ ml: 1 }}>
          Request comment
        </Button>
      </Box>

      {/* Plain-English explainer — testers were confusing this section's
          per-department feedback with the stage panel's audit-trail comment.
          Keep the language explicit so the two are unmistakable. */}
      <Alert severity="info" icon={false} sx={{ mb: 1, py: 0.5 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          <strong>This section captures each department&apos;s feedback on the change.</strong>
          {' '}Use <em>Request comment</em> to add a department, then that department&apos;s
          HOD writes their response in the row below. The
          <em> &ldquo;Comment for audit trail&rdquo;</em> field on the stage panel above
          is separate — it&apos;s the audit reason for forwarding/rejecting the record itself.
        </Typography>
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No department comments requested yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rows.map((r) => (
            <Box key={r.id} sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
                p: 1.2, bgcolor: r.status === 'COMPLETED' ? 'success.50' : 'warning.50',
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>{r.departmentName}</Typography>
                <Chip size="small" label={r.status}
                      color={r.status === 'COMPLETED' ? 'success' : 'warning'} />
                {r.doneByName && (
                  <Typography variant="caption" color="text.secondary">
                    by <strong>{r.doneByName}</strong>
                    {r.doneAt ? ` · ${formatDateTime(r.doneAt)}` : ''}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                {r.status === 'PENDING' && canFill(r) && (
                  <Tooltip title="Fill in comment">
                    <IconButton size="small" color="primary" onClick={() => openFill(r)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {r.comment && (
                <Typography variant="body2" sx={{ mt: 0.6, whiteSpace: 'pre-wrap' }}>
                  {r.comment}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* Request-comment dialog */}
      <Dialog open={reqOpen} onClose={() => setReqOpen(false)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleRequest(); } }}>
        <DialogTitle>Request department comment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {reqError && <Alert severity="error" sx={{ mb: 2 }}>{reqError}</Alert>}
          <TextField label="Department" select required fullWidth value={reqDept}
                     onChange={(e) => setReqDept(e.target.value)}
                     helperText="The HOD of the chosen department will be asked to comment.">
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id} disabled={pendingDeptIds.has(d.id)}>
                {d.name} ({d.code}) {pendingDeptIds.has(d.id) ? '· already pending' : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReqOpen(false)} disabled={reqSaving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={reqSaving || !reqDept}>
            {reqSaving ? 'Requesting…' : 'Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fill-comment dialog */}
      <Dialog open={!!fillRow} onClose={() => setFillRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleFill(); } }}>
        <DialogTitle>{fillRow?.departmentName} — department feedback</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {fillError && <Alert severity="error" sx={{ mb: 2 }}>{fillError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Write your <strong>department&apos;s feedback</strong> on this change
            below. This is captured against your department on the printed CC
            cover sheet and the audit trail records it under your name + timestamp
            automatically — you don&apos;t need a separate audit comment here.
          </Alert>
          <TextField
            label="Department's feedback / response"
            required multiline rows={5} fullWidth
            value={fillText} onChange={(e) => setFillText(e.target.value)}
            placeholder={`E.g. "Concur with the proposed change. Recommend updating SOP-123 before go-live."`}
            helperText="Plain text — what your department thinks about the proposed change."
            inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFillRow(null)} disabled={fillSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={fillSaving || !fillText.trim()}>
            {fillSaving ? 'Saving…' : 'Submit comment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QmsDepartmentCommentsSection;
