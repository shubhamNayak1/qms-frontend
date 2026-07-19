import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon,
  CheckCircle as ApproveIcon, Cancel as RejectIcon,
  DeleteOutline as DeleteIcon, AttachFile as AttachIcon,
} from '@mui/icons-material';
import {
  listDeptAttachmentsApi, requestDeptAttachmentApi, uploadDeptAttachmentApi,
  decideDeptAttachmentApi, deleteDeptAttachmentApi,
  listActionItemsForDeptApi, recordActionItemExtensionApi,
} from '../../api/qmsCommonApi';
import { listDepartmentsApi } from '../../api/orgApi';
import { getDocumentsApi } from '../../api/dmsApi';
import { formatDateTime } from '../../utils/helpers';

/**
 * QmsDepartmentAttachmentsSection — per-dept file uploads that back the
 * PENDING_ATTACHMENTS gate on Deviation / Incident / CAPA / Change Control.
 *
 * Three actor flows:
 *
 *   • QA Reviewer / Head QA: clicks "Invite department", picks a dept →
 *     PENDING row with no file yet.
 *
 *   • Department member: clicks the pencil on their dept's row →
 *     opens a dialog with a DMS document picker (Autocomplete over
 *     getDocumentsApi) + a free-text fallback. Submitting fills
 *     attachment_ref + status stays PENDING.
 *
 *   • Head QA: clicks the green check or red X on a row that has an
 *     attachment_ref → row → APPROVED / REJECTED with a comment.
 *
 * The backend's requireDeptAttachmentsApproved guard blocks the
 * PENDING_ATTACHMENTS → PENDING_VERIFICATION transition until every row
 * is APPROVED.
 *
 * Props:
 *   commonSlug   : kebab-case backend recordType ("deviation", "incident",
 *                  "capa", "change-control")
 *   recordId     : numeric id of the QMS record
 *   currentUser  : optional — used to gate the upload pencil opportunistically
 */
const QmsDepartmentAttachmentsSection = ({ commonSlug, recordId, currentUser }) => {
  const [rows, setRows]               = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // Invite dialog
  const [reqOpen, setReqOpen]   = useState(false);
  const [reqDept, setReqDept]   = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqError, setReqError] = useState(null);

  // Upload dialog (dept)
  const [uploadRow, setUploadRow]     = useState(null);
  const [pickedDoc, setPickedDoc]     = useState(null);   // DMS document object
  const [freeRef, setFreeRef]         = useState('');     // fallback free text
  const [uploadNote, setUploadNote]   = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadError, setUploadError]   = useState(null);

  // DMS picker state
  const [dmsQuery, setDmsQuery]       = useState('');
  const [dmsList, setDmsList]         = useState([]);
  const [dmsLoading, setDmsLoading]   = useState(false);

  // Batch C RED-5 — action-item picker + overdue extension
  const [actionItems, setActionItems] = useState([]);      // items for uploadRow.departmentId
  const [pickedItem, setPickedItem]   = useState(null);
  const [extDate, setExtDate]         = useState('');
  const [extReason, setExtReason]     = useState('');
  const [extSaving, setExtSaving]     = useState(false);

  // Decision dialog (Head QA)
  const [decideRow, setDecideRow]   = useState(null);
  const [decideApprove, setDecideApprove] = useState(true);
  const [decideComment, setDecideComment] = useState('');
  const [decideSaving, setDecideSaving]   = useState(false);
  const [decideError, setDecideError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!commonSlug || !recordId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await listDeptAttachmentsApi(commonSlug, recordId);
      setRows(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attachments.');
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

  // Live DMS search — debounced, runs only when the upload dialog is open.
  useEffect(() => {
    if (!uploadRow) return;
    setDmsLoading(true);
    const t = setTimeout(() => {
      getDocumentsApi({ search: dmsQuery, size: 25, status: 'EFFECTIVE' })
        .then(({ data }) => setDmsList(data?.data?.content || data?.data || []))
        .catch(() => setDmsList([]))
        .finally(() => setDmsLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [dmsQuery, uploadRow]);

  // Department invitation
  const handleRequest = async () => {
    if (!reqDept) return;
    setReqSaving(true); setReqError(null);
    try {
      await requestDeptAttachmentApi(commonSlug, recordId, reqDept);
      setReqOpen(false); setReqDept('');
      fetch();
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to invite department.');
    } finally {
      setReqSaving(false);
    }
  };

  // Open upload dialog
  const openUpload = (row) => {
    setUploadRow(row);
    setPickedDoc(null);
    setFreeRef(row.attachmentRef && !row.dmsDocumentId ? row.attachmentRef : '');
    setUploadNote(row.attachmentNote || '');
    setUploadError(null);
    setDmsQuery('');
    // Pre-select if already linked to a DMS doc
    if (row.dmsDocumentId) {
      setPickedDoc({
        id: row.dmsDocumentId,
        docNumber: row.dmsDocumentNumber,
        title: row.dmsDocumentTitle,
        version: row.dmsDocumentVersion,
      });
    }
    // Batch C RED-5 — fetch this dept's action items so the user can pick
    // which action plan the upload satisfies. Pre-select if the row already
    // has an action_item_id (auto-spawned by the workflow engine).
    setActionItems([]); setPickedItem(null); setExtDate(''); setExtReason('');
    listActionItemsForDeptApi(commonSlug, recordId, row.departmentId)
      .then(({ data }) => {
        const items = data?.data || [];
        setActionItems(items);
        if (row.actionItemId) {
          setPickedItem(items.find(i => i.id === row.actionItemId) || null);
        }
      })
      .catch(() => setActionItems([]));
  };

  const isItemOverdue = (item) => {
    if (!item) return false;
    const deadline = item.extensionDate || item.targetDate;
    if (!deadline) return false;
    return new Date(deadline) < new Date(new Date().toDateString());
  };

  const handleUpload = async () => {
    if (!uploadRow) return;
    const ref = pickedDoc ? String(pickedDoc.id) : freeRef.trim();
    if (!ref) {
      setUploadError('Pick a DMS document or type a reference.');
      return;
    }
    // Batch C RED-5 — an action plan must be picked if any exist. Overdue
    // items must have an extension recorded first (or picked date > today).
    if (actionItems.length > 0 && !pickedItem) {
      setUploadError('Pick the action plan this attachment satisfies.');
      return;
    }
    if (isItemOverdue(pickedItem) && !extDate) {
      setUploadError('Action plan is overdue — record an extension date first.');
      return;
    }
    setUploadSaving(true); setUploadError(null);
    try {
      // Extension first — separate call so the audit trail records both.
      if (isItemOverdue(pickedItem) && extDate) {
        setExtSaving(true);
        await recordActionItemExtensionApi(
          commonSlug, recordId, pickedItem.id,
          { extensionDate: extDate, extensionReason: extReason || null });
        setExtSaving(false);
      }
      await uploadDeptAttachmentApi(commonSlug, recordId, uploadRow.id, {
        attachmentRef: ref,
        attachmentNote: uploadNote.trim() || null,
        actionItemId: pickedItem ? pickedItem.id : null,
      });
      setUploadRow(null);
      fetch();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to save attachment.');
    } finally {
      setUploadSaving(false); setExtSaving(false);
    }
  };

  // Open decision dialog
  const openDecide = (row, approve) => {
    setDecideRow(row);
    setDecideApprove(approve);
    setDecideComment('');
    setDecideError(null);
  };

  const handleDecide = async () => {
    if (!decideRow || !decideComment.trim()) return;
    setDecideSaving(true); setDecideError(null);
    try {
      await decideDeptAttachmentApi(commonSlug, recordId, decideRow.id, {
        approve: decideApprove,
        comment: decideComment.trim(),
      });
      setDecideRow(null);
      fetch();
    } catch (err) {
      setDecideError(err.response?.data?.message || 'Failed to record decision.');
    } finally {
      setDecideSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove ${row.departmentName}'s attachment row?`)) return;
    try {
      await deleteDeptAttachmentApi(commonSlug, recordId, row.id);
      fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove row.');
    }
  };

  const statusColor = (s) => {
    switch (s) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      default:         return 'warning';
    }
  };

  // Heuristic: dept member can fill their own dept's row.
  const canFill = (row) =>
    !!currentUser?.departmentId && currentUser.departmentId === row.departmentId;

  // Pending dept ids — block re-inviting a dept that already has an open row.
  const openDeptIds = new Set(rows.filter(r => r.status !== 'APPROVED').map(r => r.departmentId));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                    letterSpacing={0.5} color="text.secondary" sx={{ flex: 1 }}>
          Department Attachments
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetch}>
            <RefreshIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setReqOpen(true)} sx={{ ml: 1 }}>
          Invite department
        </Button>
      </Box>

      <Alert severity="info" icon={false} sx={{ mb: 1, py: 0.5 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          <strong>Each invited department uploads a supporting DMS document; Head QA approves every row.</strong>
          {' '}Closure is blocked by the backend until every row is APPROVED.
          Pick a DMS document from the dropdown for automatic title resolution,
          or type any free-text reference for external attachments.
        </Typography>
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No departments have been invited to upload yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rows.map((r) => (
            <Box key={r.id} sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
                p: 1.2,
                bgcolor: r.status === 'APPROVED' ? 'success.50' :
                         r.status === 'REJECTED' ? 'error.50'   : 'warning.50',
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>{r.departmentName}</Typography>
                <Chip size="small" label={r.status} color={statusColor(r.status)} />
                {r.dmsDocumentNumber && (
                  <Tooltip title={r.dmsDocumentTitle || ''}>
                    <Chip size="small" icon={<AttachIcon fontSize="small" />}
                          label={`${r.dmsDocumentNumber} v${r.dmsDocumentVersion || '?'}`}
                          variant="outlined" />
                  </Tooltip>
                )}
                {r.attachmentRef && !r.dmsDocumentId && (
                  <Chip size="small" icon={<AttachIcon fontSize="small" />}
                        label={r.attachmentRef.length > 30
                          ? r.attachmentRef.slice(0, 30) + '…' : r.attachmentRef}
                        variant="outlined" />
                )}

                <Box sx={{ flex: 1 }} />

                {/* Dept upload / re-upload */}
                {(r.status !== 'APPROVED') && canFill(r) && (
                  <Tooltip title={r.attachmentRef ? 'Update upload' : 'Upload attachment'}>
                    <IconButton size="small" color="primary" onClick={() => openUpload(r)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}

                {/* Head QA decisions — only when there's an attachment to review */}
                {r.attachmentRef && r.status !== 'APPROVED' && (
                  <>
                    <Tooltip title="Approve attachment">
                      <IconButton size="small" color="success"
                                  onClick={() => openDecide(r, true)}>
                        <ApproveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reject — send back for re-upload">
                      <IconButton size="small" color="error"
                                  onClick={() => openDecide(r, false)}>
                        <RejectIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}

                {/* Soft-delete (only on non-APPROVED rows) */}
                {r.status !== 'APPROVED' && (
                  <Tooltip title="Remove row">
                    <IconButton size="small" onClick={() => handleDelete(r)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {r.dmsDocumentTitle && (
                <Typography variant="body2" sx={{ mt: 0.4 }}>
                  <strong>Doc:</strong> {r.dmsDocumentTitle}
                </Typography>
              )}
              {r.attachmentNote && (
                <Typography variant="body2" sx={{ mt: 0.3, whiteSpace: 'pre-wrap' }}>
                  <strong>Note:</strong> {r.attachmentNote}
                </Typography>
              )}
              {r.decisionNote && (
                <Typography variant="body2" sx={{ mt: 0.4, whiteSpace: 'pre-wrap' }}>
                  <strong>Head QA ({r.status}):</strong> {r.decisionNote}
                  {r.decidedByName && (
                    <Typography component="span" variant="caption"
                                color="text.secondary" sx={{ ml: 0.5 }}>
                      — {r.decidedByName}
                      {r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ''}
                    </Typography>
                  )}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* Invite dialog */}
      <Dialog open={reqOpen} onClose={() => setReqOpen(false)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleRequest(); } }}>
        <DialogTitle>Invite department to upload</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {reqError && <Alert severity="error" sx={{ mb: 2 }}>{reqError}</Alert>}
          <TextField label="Department" select required fullWidth value={reqDept}
                     onChange={(e) => setReqDept(e.target.value)}
                     helperText="The HOD / a member of the chosen department will upload the attachment.">
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id} disabled={openDeptIds.has(d.id)}>
                {d.name} ({d.code}) {openDeptIds.has(d.id) ? '· already open' : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReqOpen(false)} disabled={reqSaving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={reqSaving || !reqDept}>
            {reqSaving ? 'Inviting…' : 'Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload dialog (dept) */}
      <Dialog open={!!uploadRow} onClose={() => setUploadRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleUpload(); } }}>
        <DialogTitle>{uploadRow?.departmentName} — upload attachment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Pick the supporting <strong>DMS document</strong> from the dropdown — its title and version
            will resolve automatically. If the document isn&apos;t in DMS yet,
            type a free-text reference (file path, external link) instead.
          </Alert>

          {/* Batch C RED-5 — action-plan picker + inline overdue extension. */}
          {actionItems.length > 0 && (
            <>
              <Autocomplete
                options={actionItems}
                value={pickedItem}
                getOptionLabel={(o) => o
                  ? `${o.description}${o.targetDate ? '  ·  target ' + o.targetDate : ''}`
                  : ''}
                isOptionEqualToValue={(a, b) => a?.id === b?.id}
                onChange={(_, val) => { setPickedItem(val); setExtDate(''); setExtReason(''); }}
                renderInput={(params) => (
                  <TextField {...params} label="Action Plan / Activity" required
                             placeholder="Pick the action plan this attachment satisfies"
                             fullWidth sx={{ mb: 2 }}
                             helperText={pickedItem
                               ? (pickedItem.extensionDate
                                    ? `Extension to ${pickedItem.extensionDate} in effect.`
                                    : (pickedItem.targetDate
                                        ? `Target date ${pickedItem.targetDate}.`
                                        : 'No target date set.'))
                               : 'Only action plans belonging to your dept show up here.'} />
                )}
              />
              {isItemOverdue(pickedItem) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>This action plan is overdue.</strong> Record an
                    extension date before uploading.
                  </Typography>
                  <TextField label="New target date" type="date" required
                             value={extDate}
                             onChange={(e) => setExtDate(e.target.value)}
                             InputLabelProps={{ shrink: true }}
                             inputProps={{ min: new Date().toISOString().slice(0, 10),
                                           autoComplete: 'off' }}
                             fullWidth sx={{ mb: 1 }} />
                  <TextField label="Reason (optional)" value={extReason}
                             onChange={(e) => setExtReason(e.target.value)}
                             fullWidth inputProps={{ autoComplete: 'off' }} />
                </Alert>
              )}
            </>
          )}

          <Autocomplete
            options={dmsList}
            value={pickedDoc}
            getOptionLabel={(o) => o
              ? `${o.docNumber} v${o.version || '?'} — ${o.title}`
              : ''}
            isOptionEqualToValue={(a, b) => a?.id === b?.id}
            loading={dmsLoading}
            onInputChange={(_, val) => setDmsQuery(val)}
            onChange={(_, val) => setPickedDoc(val)}
            renderInput={(params) => (
              <TextField {...params} label="DMS Document"
                         placeholder="Search by number or title…"
                         helperText={pickedDoc
                           ? `Linked to DMS document #${pickedDoc.id}.`
                           : 'Pick from DMS or use the free-text fallback below.'}
                         fullWidth sx={{ mb: 2 }} />
            )}
          />

          <TextField label="Free-text Reference (fallback)" fullWidth
                     value={freeRef} onChange={(e) => { setFreeRef(e.target.value); setPickedDoc(null); }}
                     placeholder="Path / URL / external doc number…"
                     helperText={pickedDoc
                       ? 'Not used while a DMS document is selected.'
                       : 'Used only if no DMS document is selected.'}
                     disabled={!!pickedDoc}
                     sx={{ mb: 2 }} inputProps={{ autoComplete: 'off' }} />

          <TextField label="Note (optional)" multiline rows={2} fullWidth
                     value={uploadNote} onChange={(e) => setUploadNote(e.target.value)}
                     placeholder="Anything Head QA should know about this attachment…"
                     inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadRow(null)} disabled={uploadSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={uploadSaving || extSaving
                           || (!pickedDoc && !freeRef.trim())
                           || (actionItems.length > 0 && !pickedItem)
                           || (isItemOverdue(pickedItem) && !extDate)}>
            {uploadSaving ? 'Saving…' : 'Submit attachment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Decision dialog (Head QA) */}
      <Dialog open={!!decideRow} onClose={() => setDecideRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleDecide(); } }}>
        <DialogTitle>
          {decideRow?.departmentName} — {decideApprove ? 'approve' : 'reject'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {decideError && <Alert severity="error" sx={{ mb: 2 }}>{decideError}</Alert>}
          <Alert severity={decideApprove ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {decideApprove
              ? 'Approving locks this row. When every row is APPROVED, the record can move to Verification.'
              : 'Rejecting sends the row back to the department for re-upload.'}
          </Alert>
          {decideRow?.dmsDocumentTitle && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Reviewing:</strong> {decideRow.dmsDocumentNumber} —{' '}
              {decideRow.dmsDocumentTitle} (v{decideRow.dmsDocumentVersion})
            </Typography>
          )}
          {decideRow?.attachmentRef && !decideRow?.dmsDocumentId && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Reviewing:</strong> {decideRow.attachmentRef}
            </Typography>
          )}
          <TextField label="Decision Comment" required multiline rows={3} fullWidth
                     value={decideComment} onChange={(e) => setDecideComment(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDecideRow(null)} disabled={decideSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  color={decideApprove ? 'success' : 'error'}
                  disabled={decideSaving || !decideComment.trim()}>
            {decideSaving ? 'Saving…' : (decideApprove ? 'Approve' : 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QmsDepartmentAttachmentsSection;
