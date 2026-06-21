import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon, Refresh as RefreshIcon,
  Check as ApproveIcon, Close as RejectIcon,
} from '@mui/icons-material';
import {
  getExtensionApi, requestExtensionApi, decideExtensionApi,
} from '../../api/qmsCommonApi';
import { formatDate, formatDateTime } from '../../utils/helpers';

const STATUS_COLORS = {
  PENDING:  'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

/**
 * TargetDateExtensionPanel — surfaces the extension state on a record and
 * lets the right actor request / decide an extension.
 *
 * Backend gates:
 *   - request: any authenticated user (typically the Initiator)
 *   - decide:  HOD of record's dept / QA Reviewer / QA Head / SUPER_ADMIN
 *
 * UX shows both buttons; backend enforces.
 */
const TargetDateExtensionPanel = ({ commonSlug, recordId, currentTargetDate }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Request dialog
  const [reqOpen, setReqOpen]     = useState(false);
  const [reqDate, setReqDate]     = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqError, setReqError]   = useState(null);

  // Decide dialog
  const [decideOpen, setDecideOpen]   = useState(null); // 'approve' | 'reject' | null
  const [decideRemark, setDecideRemark] = useState('');
  const [decideSaving, setDecideSaving] = useState(false);
  const [decideError, setDecideError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!commonSlug || !recordId) return;
    setLoading(true); setError(null);
    try {
      const { data: r } = await getExtensionApi(commonSlug, recordId);
      setData(r?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load extension state.');
    } finally {
      setLoading(false);
    }
  }, [commonSlug, recordId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Request
  const handleRequest = async () => {
    setReqSaving(true); setReqError(null);
    try {
      await requestExtensionApi(commonSlug, recordId, {
        extensionDate: reqDate,
        reason: reqReason.trim(),
      });
      setReqOpen(false); setReqDate(''); setReqReason('');
      fetch();
    } catch (err) {
      setReqError(err.response?.data?.message || 'Failed to request extension.');
    } finally {
      setReqSaving(false);
    }
  };

  // Decide
  const handleDecide = async () => {
    setDecideSaving(true); setDecideError(null);
    try {
      await decideExtensionApi(commonSlug, recordId, {
        approve: decideOpen === 'approve',
        remark:  decideRemark.trim(),
      });
      setDecideOpen(null); setDecideRemark('');
      fetch();
    } catch (err) {
      setDecideError(err.response?.data?.message || 'Failed to record decision.');
    } finally {
      setDecideSaving(false);
    }
  };

  const status   = data?.status;
  const pending  = status === 'PENDING';
  const noActive = !status; // nothing requested

  // Min date for extension picker = tomorrow
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                    letterSpacing={0.5} color="text.secondary" sx={{ flex: 1 }}>
          Target Date Extension
        </Typography>
        <Tooltip title="Refresh"><IconButton size="small" onClick={fetch}>
          <RefreshIcon fontSize="inherit" />
        </IconButton></Tooltip>
        {(noActive || status === 'REJECTED' || status === 'APPROVED') && (
          <Button size="small" startIcon={<CalendarIcon />} onClick={() => {
            setReqDate(''); setReqReason(''); setReqError(null); setReqOpen(true);
          }}>
            Request extension
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading && !data ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : noActive ? (
        <Typography variant="body2" color="text.secondary">
          No extension has been requested.{' '}
          {currentTargetDate
            ? <>Current target: <strong>{formatDate(currentTargetDate)}</strong>.</>
            : null}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{
            p: 1.5, borderLeft: '4px solid',
            borderLeftColor: status === 'PENDING'  ? 'warning.main'
                           : status === 'APPROVED' ? 'success.main'
                           : 'error.main',
          }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip size="small" label={status} color={STATUS_COLORS[status] || 'default'} />
            <Typography variant="body2">
              New target date: <strong>{formatDate(data.extensionDate)}</strong>
              {data.previousTargetDate && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (was {formatDate(data.previousTargetDate)})
                </Typography>
              )}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {pending && (
              <>
                <Tooltip title="Approve">
                  <IconButton size="small" color="success"
                              onClick={() => { setDecideOpen('approve'); setDecideRemark(''); setDecideError(null); }}>
                    <ApproveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reject">
                  <IconButton size="small" color="error"
                              onClick={() => { setDecideOpen('reject'); setDecideRemark(''); setDecideError(null); }}>
                    <RejectIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>

          {data.reason && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Reason:</strong> {data.reason}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Requested by <strong>#{data.requestedById}</strong>
            {data.requestedAt ? ` on ${formatDateTime(data.requestedAt)}` : ''}
            {data.decidedAt && (
              <> · decided by <strong>#{data.decidedById}</strong> on {formatDateTime(data.decidedAt)}</>
            )}
          </Typography>
          {data.decisionRemark && (
            <Typography variant="caption" color="text.secondary" display="block" fontStyle="italic">
              "{data.decisionRemark}"
            </Typography>
          )}
        </Paper>
      )}

      {/* Request dialog */}
      <Dialog open={reqOpen} onClose={() => setReqOpen(false)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleRequest(); } }}>
        <DialogTitle>Request target-date extension</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {reqError && <Alert severity="error" sx={{ mb: 2 }}>{reqError}</Alert>}
          <TextField label="New target date" type="date" required fullWidth sx={{ mb: 2 }}
                     value={reqDate}
                     onChange={(e) => setReqDate(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     inputProps={{ min: tomorrow, autoComplete: 'off' }} />
          <TextField label="Remark / Justification" multiline rows={3} required fullWidth
                     value={reqReason}
                     onChange={(e) => setReqReason(e.target.value)}
                     placeholder="Why is the original target no longer achievable?"
                     inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReqOpen(false)} disabled={reqSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={reqSaving || !reqDate || !reqReason.trim()}>
            {reqSaving ? 'Requesting…' : 'Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Decide dialog */}
      <Dialog open={!!decideOpen} onClose={() => setDecideOpen(null)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleDecide(); } }}>
        <DialogTitle>
          {decideOpen === 'approve' ? 'Approve extension' : 'Reject extension'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {decideError && <Alert severity="error" sx={{ mb: 2 }}>{decideError}</Alert>}
          <TextField label="Remark / Justification" required multiline rows={3} fullWidth
                     value={decideRemark}
                     onChange={(e) => setDecideRemark(e.target.value)}
                     placeholder="Recorded on the audit trail."
                     inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDecideOpen(null)} disabled={decideSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  color={decideOpen === 'approve' ? 'success' : 'error'}
                  disabled={decideSaving || !decideRemark.trim()}>
            {decideSaving ? 'Saving…' : decideOpen === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TargetDateExtensionPanel;
