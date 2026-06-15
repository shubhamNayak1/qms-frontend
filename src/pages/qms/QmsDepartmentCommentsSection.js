import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Switch,
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
 *   commonSlug          : kebab-case backend recordType
 *   recordId            : numeric id of the QMS record
 *   currentUser         : optional — if provided we hide actions when clearly not
 *                          applicable (purely UX, server still enforces)
 *   recordTargetDate    : optional — parent record's target_completion_date.
 *                          When supplied, the Fill dialog's Target Date picker
 *                          uses this as the max= upper bound (item 23 of the
 *                          May 2026 tester feedback). The server is still
 *                          authoritative.
 */
const QmsDepartmentCommentsSection = ({ commonSlug, recordId, currentUser, recordTargetDate }) => {
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
  const [fillRow, setFillRow]           = useState(null);
  const [fillText, setFillText]         = useState('');
  const [fillActionReq, setFillActionReq] = useState(false);
  const [fillTargetDate, setFillTargetDate] = useState('');
  const [fillSaving, setFillSaving]     = useState(false);
  const [fillError, setFillError]       = useState(null);

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
    setFillActionReq(!!row.actionRequired);
    setFillTargetDate(row.targetDate || '');
    setFillError(null);
  };
  const handleFill = async () => {
    if (!fillRow || !fillText.trim()) return;
    // Client-side check: when action_required = YES, target_date is mandatory
    // AND it must be ≤ the parent record's target_completion_date when that's
    // supplied. The backend re-validates both.
    if (fillActionReq) {
      if (!fillTargetDate) {
        setFillError('Target Date is required when Action / Activity Required is YES.');
        return;
      }
      // Round-2 E1: target date must be strictly greater than today.
      // Software-side guard so the picker can't save a past or today date —
      // the server re-validates the same rule.
      const today = new Date(); today.setHours(0,0,0,0);
      const picked = new Date(fillTargetDate + 'T00:00:00');
      if (picked <= today) {
        setFillError('Target Date must be a future date (later than today).');
        return;
      }
      if (recordTargetDate && fillTargetDate > recordTargetDate) {
        setFillError(
          `Target Date ${fillTargetDate} must be on or before the parent record's target completion date ${recordTargetDate}.`);
        return;
      }
    }
    setFillSaving(true); setFillError(null);
    try {
      await fillDeptCommentApi(commonSlug, recordId, fillRow.id, {
        departmentId:   fillRow.departmentId,
        comment:        fillText.trim(),
        actionRequired: fillActionReq,
        targetDate:     fillActionReq ? fillTargetDate : null,
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

  // Round-2 G1 — progress indicator. Tester was confused why the parent
  // record status stayed at "Pending Department Comment" after they
  // submitted their own row. The status correctly stays until ALL depts
  // have responded AND the QA Reviewer forwards — surface the count here
  // so it's not a mystery.
  const completedCount = rows.filter(r => r.status === 'COMPLETED').length;
  const pendingCount   = rows.filter(r => r.status === 'PENDING').length;
  const allDone        = rows.length > 0 && pendingCount === 0;

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

      {/* Round-2 G1 — progress + ready-for-QA banner. */}
      {rows.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
          <Chip size="small" color="success" label={`${completedCount} responded`} />
          {pendingCount > 0 && (
            <Chip size="small" color="warning" label={`${pendingCount} pending`} />
          )}
        </Stack>
      )}
      {allDone && (
        <Alert severity="success" sx={{ mb: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            <strong>All requested departments have responded.</strong>{' '}
            The record is now ready for the QA Reviewer to forward — the
            workflow remains at <em>Pending Department Comment</em> until QA
            clicks <em>Approve / Forward</em> on the stage panel above.
          </Typography>
        </Alert>
      )}

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
              {/* Action Required + Target Date — surfaced when set */}
              {r.actionRequired && (
                <Stack direction="row" spacing={1} sx={{ mt: 0.6 }} flexWrap="wrap">
                  <Chip size="small" color="warning" label="Action Required" />
                  {r.targetDate && (
                    <Chip size="small" variant="outlined" label={`Target ${r.targetDate}`} />
                  )}
                </Stack>
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

      {/* Fill-comment dialog — Remark + Action Required + (conditional) Target Date */}
      <Dialog open={!!fillRow} onClose={() => setFillRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleFill(); } }}>
        <DialogTitle>{fillRow?.departmentName} — department feedback</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {fillError && <Alert severity="error" sx={{ mb: 2 }}>{fillError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Write your <strong>department&apos;s remark</strong> on this change
            below. If your department needs to perform a follow-up action, toggle
            <em> Action / Activity Required</em> and supply a Target Date — it
            must be on or before the parent record&apos;s target completion date.
          </Alert>
          {/* 1. Department remark — Round-2 G1: was simply "Remark" before,
              which testers missed. Made the label explicit so it can't be
              confused with the audit-trail remark on the parent stage panel. */}
          <TextField
            label="Department Remark / Feedback"
            required multiline rows={5} fullWidth
            value={fillText} onChange={(e) => setFillText(e.target.value)}
            placeholder={`E.g. "Concur with the proposed change. Recommend updating SOP-123 before go-live."`}
            helperText="This is your department&apos;s response to the change. It appears in the row below once submitted."
            sx={{ mb: 2 }}
            inputProps={{ autoComplete: 'off' }} />

          {/* 2. Action / Activity Required toggle */}
          <FormControlLabel
            control={
              <Switch checked={fillActionReq}
                      onChange={(e) => {
                        setFillActionReq(e.target.checked);
                        if (!e.target.checked) setFillTargetDate('');
                      }} />
            }
            label={
              <span>
                <strong>Action / Activity Required</strong>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Tick if your department must perform a follow-up action against this change.
                </Typography>
              </span>
            }
            sx={{ alignItems: 'flex-start', mb: 1 }}
          />

          {/* 3. Conditional Target Date — only when Action Required = YES */}
          {fillActionReq && (
            <TextField
              label="Target Date" type="date" required fullWidth
              value={fillTargetDate}
              onChange={(e) => setFillTargetDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                autoComplete: 'off',
                // Software-controlled bounds — min is tomorrow (Round-2 E1
                // forbids picking past or today), max is the CC target
                // completion date when supplied. The server re-validates.
                min: (() => {
                  const d = new Date(); d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })(),
                ...(recordTargetDate ? { max: recordTargetDate } : {}),
              }}
              helperText={
                recordTargetDate
                  ? `Must be a future date and on or before the parent record's target completion date (${recordTargetDate}).`
                  : 'Set a future date by which your department will complete the action.'
              }
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFillRow(null)} disabled={fillSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={fillSaving || !fillText.trim() || (fillActionReq && !fillTargetDate)}>
            {fillSaving ? 'Saving…' : 'Submit comment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QmsDepartmentCommentsSection;
