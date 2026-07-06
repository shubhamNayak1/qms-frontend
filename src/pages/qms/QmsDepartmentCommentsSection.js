import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  listDeptCommentsApi, requestDeptCommentApi, fillDeptCommentApi,
  deleteDeptCommentApi,
  // Round-N (2026-07-04) tester CC-Point-2 · Issue 6.
  listDeptActionItemsApi, createDeptActionItemApi,
  updateDeptActionItemApi, deleteDeptActionItemApi,
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
// Round-N (2026-07-04) tester CC-Point-2 · Issue 6: per-row inline
// panel that lists / adds / edits / deletes the discrete action items
// attached to a dept-comment row. Only the dept's HOD sees the
// add / edit / delete controls; the backend authorizes.
const STATUS_COLOR = { PENDING: 'warning', IN_PROGRESS: 'info', COMPLETED: 'success' };

const daysUntil = (yyyyMmDd) => {
  if (!yyyyMmDd) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const dt = new Date(yyyyMmDd + 'T00:00:00');
  return Math.round((dt - today) / (24 * 3600 * 1000));
};

const ActionItemsList = ({ commonSlug, recordId, deptCommentId, canEdit, recordTargetDate }) => {
  const [items, setItems]   = useState([]);
  const [error, setError]   = useState(null);
  const [editing, setEditing] = useState(null); // null = closed; {} = new; row = edit
  const [form, setForm]     = useState({ description: '', targetDate: '', status: 'PENDING' });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const { data } = await listDeptActionItemsApi(commonSlug, recordId, deptCommentId);
      setItems(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load action items.');
    }
  }, [commonSlug, recordId, deptCommentId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => {
    setEditing({});
    setForm({ description: '', targetDate: '', status: 'PENDING' });
    setError(null);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      description: row.description || '',
      targetDate:  row.targetDate  || '',
      status:      row.status      || 'PENDING',
    });
    setError(null);
  };

  const save = async () => {
    if (!form.description.trim()) { setError('Description is required.'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        description: form.description.trim(),
        targetDate:  form.targetDate || null,
        status:      form.status,
      };
      if (editing && editing.id) {
        await updateDeptActionItemApi(commonSlug, recordId, deptCommentId, editing.id, payload);
      } else {
        await createDeptActionItemApi(commonSlug, recordId, deptCommentId, payload);
      }
      setEditing(null);
      await fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save action item.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove action item "${row.description.slice(0, 40)}"?`)) return;
    try {
      await deleteDeptActionItemApi(commonSlug, recordId, deptCommentId, row.id);
      await fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove action item.');
    }
  };

  return (
    <Box sx={{
        mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider',
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="caption" sx={{
            fontWeight: 700, letterSpacing: 0.4, color: 'text.secondary', flex: 1,
          }}>
          ACTION ITEMS ({items.length})
        </Typography>
        {canEdit && (
          <Button size="small" startIcon={<AddIcon />} onClick={openNew}>
            Add
          </Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No action items yet. {canEdit && 'Use "Add" to capture the first one.'}
        </Typography>
      ) : (
        <Stack spacing={0.6}>
          {items.map((it) => {
            const daysLeft = daysUntil(it.targetDate);
            const overdue = daysLeft != null && daysLeft < 0 && it.status !== 'COMPLETED';
            const dueSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 7 && it.status !== 'COMPLETED';
            return (
              <Box key={it.id} sx={{
                  p: 0.8, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  bgcolor: overdue ? 'error.50' : dueSoon ? 'warning.50' : 'background.paper',
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}>
                  <Typography variant="body2" sx={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                    {it.description}
                  </Typography>
                  <Chip size="small" color={STATUS_COLOR[it.status] || 'default'}
                        label={(it.status || 'PENDING').replace('_', ' ')} />
                  {canEdit && (
                    <>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(it)}>
                        <EditIcon fontSize="inherit" />
                      </IconButton></Tooltip>
                      <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => remove(it)}>
                        <DeleteIcon fontSize="inherit" />
                      </IconButton></Tooltip>
                    </>
                  )}
                </Box>
                {(it.targetDate || it.completedByName) && (
                  <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }} flexWrap="wrap">
                    {it.targetDate && (
                      <Chip size="small" variant="outlined"
                            color={overdue ? 'error' : dueSoon ? 'warning' : 'default'}
                            label={`Target ${it.targetDate}${daysLeft != null
                              ? ` · ${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue`
                                    : daysLeft === 0 ? 'due today'
                                    : `${daysLeft}d left`}` : ''}`} />
                    )}
                    {it.completedByName && (
                      <Chip size="small" variant="outlined" color="success"
                            label={`Done · ${it.completedByName}`} />
                    )}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); save(); } }}>
        <DialogTitle>{editing?.id ? 'Edit action item' : 'Add action item'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField label="Description" required multiline rows={2} fullWidth
                     value={form.description}
                     onChange={(e) => setForm({ ...form, description: e.target.value })}
                     inputProps={{ autoComplete: 'off' }} sx={{ mb: 2 }} />
          <TextField label="Target Date" type="date" fullWidth
                     InputLabelProps={{ shrink: true }}
                     value={form.targetDate}
                     onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                     inputProps={{ autoComplete: 'off',
                                    max: recordTargetDate || undefined,
                                    min: new Date().toISOString().slice(0, 10) }}
                     helperText={recordTargetDate
                       ? `DD/MM/YYYY · must be ≤ record target ${recordTargetDate}`
                       : 'DD/MM/YYYY'}
                     sx={{ mb: 2 }} />
          {editing && editing.id && (
            <TextField label="Status" select fullWidth
                       value={form.status}
                       onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['PENDING', 'IN_PROGRESS', 'COMPLETED'].map((s) =>
                <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField>
          )}
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

// Round-N (2026-07-04) tester CC-Point-2 · Issue 5: `frozen` prop
// disables Request-comment and remove icons. Panels pass frozen=true
// once the record has advanced past the QA invite stage so QA can no
// longer add/remove departments after the record was routed for
// comment.
const QmsDepartmentCommentsSection = ({ commonSlug, recordId, currentUser, recordTargetDate, onChange, frozen = false }) => {
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
      onChange?.();
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
    // Round-3 R23: Target date is OPTIONAL even when Action Required = YES.
    // We only validate it when the user actually supplied a value.
    if (fillActionReq && fillTargetDate) {
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
      onChange?.();
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

  // Round-L (2026-06-27): show the remove icon on every PENDING row.
  // The backend gates which actors may actually delete (QA Reviewer /
  // QA Head / SUPER_ADMIN) — mirroring how canFill is just a heuristic.
  // Round-N (2026-07-04): freeze after the record moves past the QA
  // invite stage so QA cannot swap the dept list mid-review.
  const canRemove = (row) => !frozen && row.status === 'PENDING';

  const handleRemove = async (row) => {
    if (!window.confirm(`Remove ${row.departmentName} from the requested departments?`)) return;
    try {
      await deleteDeptCommentApi(commonSlug, recordId, row.id);
      fetch();
      onChange?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove department row.');
    }
  };

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
        {/* Round-N (2026-07-04) tester CC-Point-2 · Issue 5: hide the
            Request-comment button once the dept list is frozen (record
            past the QA invite stage). */}
        {!frozen && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setReqOpen(true)} sx={{ ml: 1 }}>
            Request comment
          </Button>
        )}
        {frozen && (
          <Chip size="small" label="Locked" variant="outlined" sx={{ ml: 1 }}
                title="Department list is locked — QA has already routed the record for comment." />
        )}
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
                {/* Round-L (2026-06-27): QA can drop a PENDING row in case
                    the wrong dept was invited. */}
                {canRemove(r) && (
                  <Tooltip title="Remove department">
                    <IconButton size="small" color="error" onClick={() => handleRemove(r)}>
                      <DeleteIcon fontSize="small" />
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

              {/* Round-N (2026-07-04) tester CC-Point-2 · Issue 6:
                  multi-action-item panel per dept row. Dept HOD adds
                  discrete items with independent target dates. */}
              <ActionItemsList
                commonSlug={commonSlug}
                recordId={recordId}
                deptCommentId={r.id}
                canEdit={canFill(r)}
                recordTargetDate={recordTargetDate}
              />
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

          {/* 3. Conditional Target Date — only when Action Required = YES.
              Round-3 R23: now OPTIONAL (was required in Round-2). The
              picker still enforces strict-future + ≤ parent when supplied. */}
          {fillActionReq && (
            <TextField
              label="Target Date (optional)" type="date" fullWidth
              value={fillTargetDate}
              onChange={(e) => setFillTargetDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              placeholder="DD/MM/YYYY"
              inputProps={{
                autoComplete: 'off',
                min: (() => {
                  const d = new Date(); d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })(),
                ...(recordTargetDate ? { max: recordTargetDate } : {}),
              }}
              helperText={
                recordTargetDate
                  ? `DD/MM/YYYY · Optional. If set, must be future and on or before the parent record's target completion date (${recordTargetDate}).`
                  : 'DD/MM/YYYY · Optional. Set a future date if your department needs a deadline.'
              }
              sx={{ mt: 1 }}
            />
          )}
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
