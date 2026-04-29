import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, IconButton, Tooltip, Chip, Divider,
  CircularProgress, Alert, Button, Stack, LinearProgress,
  List, ListItem, ListItemText, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
  Close as CloseIcon, Refresh as RefreshIcon,
  Add as AddIcon, CheckCircle as CheckIcon, Cancel as CancelIcon,
  Article as DocIcon, VideoLibrary as VideoIcon, Link as LinkIcon,
  CalendarMonth as CalIcon, Person as PersonIcon,
  School as TrainIcon, Badge as MandatoryIcon,
  WarningAmber as RejectIcon,
} from '@mui/icons-material';
import { getProgramByIdApi, getProgramSessionsApi, raiseReviewApi, approveProgramApi,
  rejectProgramApi, planProgramApi, activateProgramApi,
  completeProgramApi, archiveProgramApi, cancelSessionApi, completeSessionApi } from '../../api/lmsApi';
import { formatDate } from '../../utils/helpers';
import {
  PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS,
  TRAINING_TYPE_COLORS, TRAINING_TYPE_LABELS,
  TRAINING_SUBTYPE_LABELS, PROGRAM_TRANSITIONS,
} from './lmsConstants';
import SessionDialog from './SessionDialog';

const CONTENT_ICONS = { DOCUMENT: <DocIcon fontSize="small" />, VIDEO: <VideoIcon fontSize="small" />, default: <LinkIcon fontSize="small" /> };

const InfoRow = ({ label, value }) => value ? (
  <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>{label}</Typography>
    <Typography variant="caption" fontWeight={600}>{value}</Typography>
  </Box>
) : null;

// ── Reject Reason Dialog ──────────────────────────────────────────────────────
const RejectDialog = ({ open, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState(null);

  const handleConfirm = async () => {
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    setBusy(true); setErr(null);
    try { await onConfirm(reason); onClose(); }
    catch (e) { setErr(e.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rejection Reason</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
        <TextField label="Reason *" multiline rows={3} fullWidth size="small" value={reason}
          onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleConfirm} disabled={busy}>
          {busy ? <CircularProgress size={16} /> : 'Reject'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Drawer ───────────────────────────────────────────────────────────────
const ProgramDetailDrawer = ({ open, onClose, programId, onUpdated }) => {
  const [program,  setProgram]  = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [actBusy,  setActBusy]  = useState(null); // action key being processed
  const [rejectOpen,  setRejectOpen]  = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editSession, setEditSession] = useState(null);

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true); setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        getProgramByIdApi(programId),
        getProgramSessionsApi(programId).catch(() => ({ data: { data: [] } })),
      ]);
      setProgram(pRes.data?.data || pRes.data);
      const sd = sRes.data?.data;
      setSessions(Array.isArray(sd) ? sd : []);
    } catch {
      setError('Failed to load program details.');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleAction = async (action, extra) => {
    setActBusy(action); setError(null);
    try {
      const apiMap = {
        'raise-review': () => raiseReviewApi(programId),
        'approve':       () => approveProgramApi(programId),
        'reject':        () => rejectProgramApi(programId, extra),
        'plan':          () => planProgramApi(programId),
        'activate':      () => activateProgramApi(programId),
        'complete':      () => completeProgramApi(programId),
        'archive':       () => archiveProgramApi(programId),
      };
      await apiMap[action]();
      await load();
      onUpdated?.();
    } catch (e) {
      setError(e.response?.data?.message || `Action '${action}' failed.`);
    } finally {
      setActBusy(null);
    }
  };

  const handleSessionAction = async (sessionId, actionFn) => {
    try { await actionFn(sessionId); await load(); }
    catch { setError('Session action failed.'); }
  };

  const transitions = program ? (PROGRAM_TRANSITIONS[program.status] || []) : [];
  const compRate = program?.complianceRate != null ? `${program.complianceRate.toFixed(1)}%` : '—';

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 580 }, display: 'flex', flexDirection: 'column' } }}>

        {/* Header */}
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, mr: 1 }}>
              {program && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  {program.code}
                </Typography>
              )}
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                {program?.title || 'Loading…'}
              </Typography>
              {program && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                  <Chip label={PROGRAM_STATUS_LABELS[program.status] || program.status}
                    size="small" color={PROGRAM_STATUS_COLORS[program.status] || 'default'} />
                  <Chip label={TRAINING_TYPE_LABELS[program.trainingType] || program.trainingType}
                    size="small" color={TRAINING_TYPE_COLORS[program.trainingType] || 'default'} variant="outlined" />
                  {program.trainingSubType && (
                    <Chip label={TRAINING_SUBTYPE_LABELS[program.trainingSubType] || program.trainingSubType}
                      size="small" variant="outlined" />
                  )}
                  {program.isMandatory && (
                    <Chip icon={<MandatoryIcon sx={{ fontSize: 12 }} />} label="Mandatory" size="small" color="warning" />
                  )}
                </Stack>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Refresh"><IconButton size="small" onClick={load} disabled={loading}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Close"><IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
          {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {program && !loading && (
            <>
              {/* Rejection banner */}
              {program.status === 'REJECTED' && program.rejectionReason && (
                <Alert severity="error" icon={<RejectIcon />} sx={{ mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} display="block">Rejection Reason</Typography>
                  {program.rejectionReason}
                </Alert>
              )}

              {/* ── Stats ── */}
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: 'Enrolled',    value: program.totalEnrollments ?? 0,    color: 'info.main' },
                  { label: 'Completed',   value: program.completedEnrollments ?? 0, color: 'success.main' },
                  { label: 'Compliance',  value: compRate,                           color: 'primary.main' },
                ].map(({ label, value, color }) => (
                  <Box key={label} sx={{ textAlign: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 90 }}>
                    <Typography variant="h5" fontWeight={800} color={color}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                ))}
                {program.examEnabled && (
                  <Box sx={{ textAlign: 'center', p: 1.5, border: '1px solid', borderColor: 'primary.light', borderRadius: 2, minWidth: 90 }}>
                    <Typography variant="h5" fontWeight={800} color="primary.main">{program.passScore}%</Typography>
                    <Typography variant="caption" color="text.secondary">Pass Score</Typography>
                  </Box>
                )}
              </Box>

              {/* ── Program Details ── */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Program Details</Typography>
              <InfoRow label="Category"    value={program.category} />
              <InfoRow label="Department"  value={program.departments || program.department} />
              <InfoRow label="Trainer"     value={program.trainerName || program.vendorName} />
              <InfoRow label="Coordinator" value={program.coordinatorName} />
              <InfoRow label="Location"    value={program.location} />
              <InfoRow label="Meeting Link" value={program.conferenceLink} />
              <InfoRow label="Duration"    value={program.estimatedDurationMinutes ? `${program.estimatedDurationMinutes} min` : null} />
              <InfoRow label="Cert Validity" value={program.certificateValidityYears ? `${program.certificateValidityYears} yr(s)` : null} />
              <InfoRow label="Deadline"    value={program.completionDeadlineDays ? `${program.completionDeadlineDays} days` : null} />
              <InfoRow label="Exam"        value={program.examEnabled ? `Enabled · Pass ${program.passScore}% · Max ${program.maxAttempts} attempts` : 'No Exam'} />
              <InfoRow label="Tags"        value={program.tags} />
              {program.description && (
                <Box sx={{ mt: 1, mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>Description</Typography>
                  <Typography variant="body2">{program.description}</Typography>
                </Box>
              )}
              <InfoRow label="Created By"  value={program.createdBy} />
              <InfoRow label="Created At"  value={formatDate(program.createdAt)} />

              <Divider sx={{ my: 2 }} />

              {/* ── Sessions ── */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Sessions <Chip label={sessions.length} size="small" sx={{ ml: 0.5 }} />
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditSession(null); setSessionDialogOpen(true); }}>
                  Add Session
                </Button>
              </Box>
              {sessions.length === 0 ? (
                <Typography variant="caption" color="text.disabled">No sessions yet.</Typography>
              ) : (
                <List dense disablePadding>
                  {sessions.map((s) => (
                    <ListItem key={s.id} disableGutters
                      sx={{ borderLeft: '3px solid', borderColor: s.status === 'COMPLETED' ? 'success.main' : s.status === 'CANCELLED' ? 'error.main' : 'primary.main',
                            pl: 1.5, mb: 0.5, borderRadius: '0 4px 4px 0', bgcolor: 'action.hover' }}>
                      <ListItemIcon sx={{ minWidth: 28 }}><CalIcon fontSize="small" color="action" /></ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{formatDate(s.sessionDate)}{s.sessionEndDate && s.sessionEndDate !== s.sessionDate ? ` – ${formatDate(s.sessionEndDate)}` : ''}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {[s.startTime, s.endTime].filter(Boolean).join(' – ')}
                            {s.venue ? ` · ${s.venue}` : ''}
                            {s.trainerName ? ` · ${s.trainerName}` : ''}
                          </Typography>
                        }
                      />
                      <Chip label={s.status} size="small"
                        color={s.status === 'COMPLETED' ? 'success' : s.status === 'CANCELLED' ? 'error' : 'default'}
                        sx={{ fontSize: 10, mr: 0.5 }} />
                      {s.status === 'SCHEDULED' && (
                        <>
                          <Tooltip title="Mark Complete">
                            <IconButton size="small" color="success" onClick={() => handleSessionAction(s.id, completeSessionApi)}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" color="error" onClick={() => handleSessionAction(s.id, (id) => cancelSessionApi(id, 'Cancelled'))}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}

              {/* ── Contents ── */}
              {program.contents?.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Materials <Chip label={program.contents.length} size="small" sx={{ ml: 0.5 }} />
                  </Typography>
                  <List dense disablePadding>
                    {program.contents.map((c) => (
                      <ListItem key={c.id} disableGutters sx={{ mb: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {CONTENT_ICONS[c.contentType] || CONTENT_ICONS.default}
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="body2">{c.title}</Typography>}
                          secondary={<Typography variant="caption" color="text.secondary">{c.contentType?.replace('_', ' ')}{c.required ? ' · Required' : ''}{c.durationMinutes ? ` · ${c.durationMinutes} min` : ''}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* ── Document Links ── */}
              {program.documentLinks?.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Linked Documents <Chip label={program.documentLinks.length} size="small" sx={{ ml: 0.5 }} />
                  </Typography>
                  <Stack spacing={0.5}>
                    {program.documentLinks.map((d) => (
                      <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DocIcon fontSize="small" color="action" />
                        <Typography variant="caption">{d.dmsDocNumber} v{d.dmsDocVersion}</Typography>
                        {d.dmsDocTitle && <Typography variant="caption" color="text.secondary">· {d.dmsDocTitle}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                </>
              )}

              {/* ── Enrollment Compliance bar ── */}
              {program.totalEnrollments > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Enrollment Progress</Typography>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography variant="caption" color="text.secondary">Completed / Total Enrolled</Typography>
                      <Typography variant="caption" fontWeight={700}>{program.completedEnrollments} / {program.totalEnrollments}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.round((program.completedEnrollments / program.totalEnrollments) * 100)}
                      sx={{ height: 8, borderRadius: 4 }}
                      color={program.complianceRate >= 80 ? 'success' : program.complianceRate >= 50 ? 'warning' : 'error'}
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </Box>

        {/* ── Workflow Actions Footer ── */}
        {transitions.length > 0 && (
          <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Actions</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {transitions.map((t) => (
                <Button
                  key={t.action}
                  size="small"
                  variant={t.color === 'error' ? 'outlined' : 'contained'}
                  color={t.color === 'default' ? 'inherit' : t.color}
                  disabled={!!actBusy}
                  onClick={() => t.requireReason ? setRejectOpen(true) : handleAction(t.action)}
                  startIcon={actBusy === t.action ? <CircularProgress size={14} /> : null}
                >
                  {t.label}
                </Button>
              ))}
            </Stack>
            {transitions.find((t) => t.note) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                {transitions.find((t) => t.note).note}
              </Typography>
            )}
          </Box>
        )}
      </Drawer>

      {/* Reject reason dialog */}
      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => handleAction('reject', reason)}
      />

      {/* Session dialog */}
      <SessionDialog
        open={sessionDialogOpen}
        onClose={() => setSessionDialogOpen(false)}
        onSaved={load}
        programId={programId}
        session={editSession}
      />
    </>
  );
};

export default ProgramDetailDrawer;
