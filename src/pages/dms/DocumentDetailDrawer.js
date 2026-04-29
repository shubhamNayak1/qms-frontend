import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, Chip,  IconButton,
  Tooltip, Button, CircularProgress, Alert, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField,
} from '@mui/material';
import {
  Close        as CloseIcon,
  Download     as DownloadIcon,
  Send         as SubmitIcon,
  CheckCircle  as ApproveIcon,
  Cancel       as RejectIcon,
  Public       as PublishIcon,
  Archive      as ObsoleteIcon,
  Undo         as WithdrawIcon,
  AddCircle    as NewVersionIcon,
  History      as HistoryIcon,
  HowToVote    as ApprovalIcon,
  Info         as InfoIcon,
} from '@mui/icons-material';
import { formatDate } from '../../utils/helpers';
import {
  getDocumentByIdApi,
  getDocumentVersionsApi,
  getDocumentApprovalsApi,
  downloadDocumentApi,
  acknowledgeDocumentApi,
  submitDocumentApi,
  approveDocumentApi,
  rejectDocumentApi,
  publishDocumentApi,
  obsoleteDocumentApi,
  withdrawDocumentApi,
} from '../../api/dmsApi';
import UploadDocumentDialog from './UploadDocumentDialog';

// ── Status metadata ────────────────────────────────────────────────────────
const STATUS_META = {
  DRAFT:        { label: 'Draft',        color: 'default'  },
  UNDER_REVIEW: { label: 'Under Review', color: 'warning'  },
  APPROVED:     { label: 'Approved',     color: 'info'     },
  EFFECTIVE:    { label: 'Effective',    color: 'success'  },
  REJECTED:     { label: 'Rejected',     color: 'error'    },
  OBSOLETE:     { label: 'Obsolete',     color: 'default'  },
  WITHDRAWN:    { label: 'Withdrawn',    color: 'warning'  },
  SUPERSEDED:   { label: 'Superseded',   color: 'default'  },
};

// ── Workflow action definitions ────────────────────────────────────────────
const ACTIONS = {
  submit: {
    label: 'Submit for Review', Icon: SubmitIcon, color: 'primary',
    commentLabel: 'Comments (optional)', required: false,
  },
  approve: {
    label: 'Approve', Icon: ApproveIcon, color: 'success',
    commentLabel: 'Approval comments (optional)', required: false,
  },
  reject: {
    label: 'Reject', Icon: RejectIcon, color: 'error',
    commentLabel: 'Reason for rejection', required: true,
  },
  publish: {
    label: 'Publish (Make Effective)', Icon: PublishIcon, color: 'success',
    needsDate: true, dateLabel: 'Effective Date (optional)',
  },
  obsolete: {
    label: 'Mark as Obsolete', Icon: ObsoleteIcon, color: 'warning',
    commentLabel: 'Reason for obsolescence', required: true,
  },
  withdraw: {
    label: 'Withdraw', Icon: WithdrawIcon, color: 'warning',
    commentLabel: 'Reason (optional)', required: false, simple: true,
  },
};

// Available workflow buttons per status
const STATUS_ACTIONS = {
  DRAFT:        ['submit', 'withdraw'],
  UNDER_REVIEW: ['approve', 'reject', 'withdraw'],
  APPROVED:     ['publish'],
  EFFECTIVE:    ['obsolete'],
};

// ── Helper ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography
      variant="caption" color="text.secondary" fontWeight={600}
      sx={{ minWidth: 130, flexShrink: 0 }}
    >
      {label}
    </Typography>
    <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
      {value ?? <span style={{ opacity: 0.4 }}>—</span>}
    </Typography>
  </Box>
);

// ── Workflow Action Dialog ─────────────────────────────────────────────────
const WorkflowDialog = ({ open, onClose, actionKey, onConfirm, busy, error }) => {
  const [comment, setComment] = useState('');
  const [date,    setDate]    = useState('');
  const act = ACTIONS[actionKey];

  useEffect(() => { if (open) { setComment(''); setDate(''); } }, [open]);

  if (!act) return null;

  const handleConfirm = () => onConfirm({ comment, date });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{act.label}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {act.needsDate && (
          <TextField
            label={act.dateLabel}
            type="date"
            fullWidth size="small"
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={{ mb: act.commentLabel ? 2 : 0 }}
          />
        )}
        {act.commentLabel && (
          <TextField
            label={act.commentLabel}
            fullWidth size="small"
            multiline rows={3}
            required={act.required}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}
        {act.simple && !act.commentLabel && (
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to withdraw this document? It will return to WITHDRAWN status.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          color={act.color}
          onClick={handleConfirm}
          disabled={busy || (act.required && !comment.trim())}
          startIcon={busy ? <CircularProgress size={16} /> : <act.Icon />}
        >
          {busy ? 'Processing…' : act.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Drawer ────────────────────────────────────────────────────────────
const DocumentDetailDrawer = ({ open, onClose, docId, onUpdated }) => {
  const [doc,          setDoc]          = useState(null);
  const [versions,     setVersions]     = useState([]);
  const [approvals,    setApprovals]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [tab,          setTab]          = useState(0);

  // Workflow action
  const [actionKey,    setActionKey]    = useState(null);
  const [actionOpen,   setActionOpen]   = useState(false);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [actionError,  setActionError]  = useState(null);

  // New version dialog
  const [newVerOpen,   setNewVerOpen]   = useState(false);

  // Download
  const [downloading,  setDownloading]  = useState(false);
  const [dlError,      setDlError]      = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const [docRes, appRes] = await Promise.all([
        getDocumentByIdApi(docId),
        getDocumentApprovalsApi(docId).catch(() => ({ data: { data: [] } })),
      ]);
      const d = docRes.data?.data;
      setDoc(d);
      setApprovals(appRes.data?.data || []);
      if (d?.documentNumber) {
        const vRes = await getDocumentVersionsApi(d.documentNumber)
          .catch(() => ({ data: { data: [] } }));
        setVersions(vRes.data?.data || []);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [docId]);

  useEffect(() => {
    if (open && docId) { setTab(0); fetchAll(); }
  }, [open, docId, fetchAll]);

  // ── Download ───────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    setDlError(null);
    try {
      const res = await downloadDocumentApi(doc.id);
      const s3Url = res.headers?.['x-download-url'];
      if (s3Url) {
        window.open(s3Url, '_blank');
        const logId = res.headers?.['x-download-log-id'];
        if (doc.isControlled && logId) {
          await acknowledgeDocumentApi(logId).catch(() => {});
        }
      } else {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a   = document.createElement('a');
        a.href    = url;
        a.download = doc.fileName
          || `${doc.documentNumber}-v${doc.currentVersion}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (_) {
      setDlError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Workflow action ────────────────────────────────────────────────────
  const openAction = (key) => {
    setActionKey(key);
    setActionError(null);
    setActionOpen(true);
  };

  const handleActionConfirm = async ({ comment, date }) => {
    if (!doc) return;
    setActionBusy(true);
    setActionError(null);
    try {
      switch (actionKey) {
        case 'submit':
          await submitDocumentApi(doc.id, comment || undefined);
          break;
        case 'approve':
          await approveDocumentApi(doc.id, { comments: comment || undefined });
          break;
        case 'reject':
          await rejectDocumentApi(doc.id, { comments: comment });
          break;
        case 'publish':
          await publishDocumentApi(doc.id, { effectiveDate: date || undefined });
          break;
        case 'obsolete':
          await obsoleteDocumentApi(doc.id, { reason: comment });
          break;
        case 'withdraw':
          await withdrawDocumentApi(doc.id);
          break;
        default: break;
      }
      setActionOpen(false);
      fetchAll();
      onUpdated?.();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────
  const statusMeta = doc ? (STATUS_META[doc.status] || { label: doc.status, color: 'default' }) : null;
  const availableActions = doc ? (STATUS_ACTIONS[doc.status] || []) : [];

  const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 540 } } }}
      >
        {/* ── Header ── */}
        <Box sx={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          p: 2.5, borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <Box sx={{ flex: 1, mr: 1, minWidth: 0 }}>
            {loading || !doc ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    {doc.documentNumber}
                  </Typography>
                  <Chip
                    label={`v${doc.currentVersion}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.68rem' }}
                  />
                  <Chip
                    label={statusMeta?.label}
                    size="small"
                    color={statusMeta?.color}
                  />
                  {doc.isControlled && (
                    <Chip label="Controlled" size="small" variant="outlined" color="warning" sx={{ fontSize: '0.68rem' }} />
                  )}
                </Box>
                <Typography variant="h6" fontWeight={700} noWrap sx={{ lineHeight: 1.3 }}>
                  {doc.title}
                </Typography>
              </>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {doc && !loading && (
          <>
            {/* ── Action buttons ── */}
            {(availableActions.length > 0 || doc.status === 'EFFECTIVE') && (
              <Box sx={{
                px: 2.5, py: 1.5,
                display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center',
                borderBottom: '1px solid', borderColor: 'divider',
                bgcolor: 'grey.50',
              }}>
                {availableActions.map((key) => {
                  const a = ACTIONS[key];
                  return (
                    <Button
                      key={key}
                      size="small"
                      variant="outlined"
                      color={a.color}
                      startIcon={<a.Icon fontSize="small" />}
                      onClick={() => openAction(key)}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {a.label}
                    </Button>
                  );
                })}
                {doc.status === 'EFFECTIVE' && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<NewVersionIcon fontSize="small" />}
                    onClick={() => setNewVerOpen(true)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    New Version
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Tooltip title={downloading ? 'Downloading…' : doc.isControlled ? 'Download (acknowledgement required)' : 'Download'}>
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon fontSize="small" />}
                      onClick={handleDownload}
                      disabled={downloading}
                    >
                      Download
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            )}

            {dlError && (
              <Alert severity="error" sx={{ mx: 2.5, mt: 1.5 }} onClose={() => setDlError(null)}>
                {dlError}
              </Alert>
            )}

            {/* ── Tabs ── */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                <Tab icon={<InfoIcon fontSize="small" />} iconPosition="start" label="Details"   sx={{ minHeight: 44, fontSize: '0.8rem' }} />
                <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Versions"  sx={{ minHeight: 44, fontSize: '0.8rem' }} />
                <Tab icon={<ApprovalIcon fontSize="small" />} iconPosition="start" label="Approvals" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
              {/* ── Tab 0: Details ── */}
              {tab === 0 && (
                <Box>
                  <InfoRow label="Document #"   value={doc.documentNumber} />
                  <InfoRow label="Title"        value={doc.title} />
                  <InfoRow label="Category"     value={doc.category} />
                  <InfoRow label="Version"      value={doc.currentVersion} />
                  <InfoRow label="Status"       value={doc.status} />
                  <InfoRow label="Access Level" value={doc.accessLevel} />
                  <InfoRow label="Department"   value={doc.department} />
                  <InfoRow label="Owner"
                    value={doc.owner?.fullName || doc.owner?.username || '—'}
                  />
                  <InfoRow label="Effective Date" value={formatDate(doc.effectiveDate)} />
                  <InfoRow label="Review Date"    value={formatDate(doc.reviewDate)} />
                  <InfoRow label="Expiry Date"    value={formatDate(doc.expiryDate)} />
                  <InfoRow label="File Name"      value={doc.fileName} />
                  <InfoRow label="File Size"      value={fmtSize(doc.fileSize)} />
                  <InfoRow label="Created By"
                    value={doc.createdBy?.fullName || doc.createdBy?.username || '—'}
                  />
                  <InfoRow label="Created"  value={formatDate(doc.createdAt)} />
                  <InfoRow label="Updated"  value={formatDate(doc.updatedAt)} />
                  {doc.description && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Description
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{doc.description}</Typography>
                    </Box>
                  )}
                  {doc.changeSummary && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Change Summary
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{doc.changeSummary}</Typography>
                    </Box>
                  )}
                  {doc.tags?.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {doc.tags.map((t) => <Chip key={t} label={t} size="small" variant="outlined" />)}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* ── Tab 1: Versions ── */}
              {tab === 1 && (
                <Box>
                  {versions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No version history available.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {['Version', 'Status', 'Created By', 'Created', 'Change Summary'].map((h) => (
                              <TableCell key={h} sx={{ fontWeight: 600, bgcolor: 'grey.50', whiteSpace: 'nowrap' }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {versions.map((v) => {
                            const vm = STATUS_META[v.status] || { label: v.status, color: 'default' };
                            const isCurrent = v.id === doc.id;
                            return (
                              <TableRow key={v.id} sx={{ bgcolor: isCurrent ? 'primary.50' : 'inherit' }}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="body2" fontWeight={600}>v{v.currentVersion}</Typography>
                                    {isCurrent && <Chip label="current" size="small" color="primary" sx={{ fontSize: '0.6rem', height: 16 }} />}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip label={vm.label} size="small" color={vm.color} />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption">
                                    {v.createdBy?.fullName || v.createdBy?.username || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption">{formatDate(v.createdAt)}</Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 160 }}>
                                  <Typography variant="caption" noWrap>{v.changeSummary || '—'}</Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* ── Tab 2: Approvals ── */}
              {tab === 2 && (
                <Box>
                  {approvals.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No approval records yet.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {approvals.map((a, i) => {
                        const isApproved = a.decision === 'APPROVED';
                        return (
                          <Paper key={a.id ?? i} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {a.approver?.fullName || a.approver?.username || `Approver #${i + 1}`}
                              </Typography>
                              <Chip
                                label={a.decision || a.status || 'PENDING'}
                                size="small"
                                color={isApproved ? 'success' : a.decision === 'REJECTED' ? 'error' : 'default'}
                              />
                            </Box>
                            {a.comments && (
                              <Typography variant="caption" color="text.secondary">
                                "{a.comments}"
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                              {formatDate(a.decidedAt || a.createdAt)}
                            </Typography>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </>
        )}

        {!doc && !loading && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Unable to load document.</Typography>
          </Box>
        )}
      </Drawer>

      {/* ── Workflow Action Dialog ── */}
      <WorkflowDialog
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        actionKey={actionKey}
        onConfirm={handleActionConfirm}
        busy={actionBusy}
        error={actionError}
      />

      {/* ── New Version Dialog ── */}
      <UploadDocumentDialog
        open={newVerOpen}
        onClose={() => setNewVerOpen(false)}
        newVersionFor={doc}
        onUploaded={() => {
          setNewVerOpen(false);
          fetchAll();
          onUpdated?.();
        }}
      />
    </>
  );
};

export default DocumentDetailDrawer;
