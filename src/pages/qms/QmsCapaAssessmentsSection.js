import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  Edit as EditIcon, Refresh as RefreshIcon,
  CheckCircle as ApproveIcon, Cancel as RejectIcon,
} from '@mui/icons-material';
import {
  listCapaAssessmentsApi, submitCapaAssessmentApi, reviewCapaAssessmentApi,
} from '../../api/qmsApi';
import { formatDateTime } from '../../utils/helpers';

/**
 * QmsCapaAssessmentsSection — post-closure CAPA effectiveness lifecycle.
 *
 * One row per scheduled cycle. Two actor flows:
 *
 *   • Responsible-dept member: when a row is PENDING (or REJECTED for
 *     re-submission), they click the pencil and submit Action Observed +
 *     Evidence + isEffective. Row → SUBMITTED.
 *
 *   • QA Reviewer: when a row is SUBMITTED, they click Approve or Reject
 *     with a review comment. Row → ACCEPTED or REJECTED.
 *
 * Accept/reject auto-promotes the parent CAPA's status:
 *   any row PENDING/REJECTED  → CAPA at EFFECTIVENESS_PENDING
 *   any row SUBMITTED         → CAPA at EFFECTIVENESS_REVIEW
 *   every row ACCEPTED        → CAPA at EFFECTIVENESS_VERIFIED (terminal)
 */
const QmsCapaAssessmentsSection = ({ capaId, onUpdated }) => {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  // Submit dialog (responsible dept fills a cycle)
  const [submitRow, setSubmitRow]       = useState(null);
  const [actionText, setActionText]     = useState('');
  const [evidenceRef, setEvidenceRef]   = useState('');
  const [isEffective, setIsEffective]   = useState(true);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitError, setSubmitError]   = useState(null);

  // Review dialog (QA accepts / rejects)
  const [reviewRow, setReviewRow]       = useState(null);
  const [reviewDecision, setReviewDecision] = useState('ACCEPTED');
  const [reviewComment, setReviewComment]   = useState('');
  const [reviewSaving, setReviewSaving]     = useState(false);
  const [reviewError, setReviewError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!capaId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await listCapaAssessmentsApi(capaId);
      setRows(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, [capaId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openSubmit = (row) => {
    setSubmitRow(row);
    setActionText(row.actionObserved || '');
    setEvidenceRef(row.evidenceRef || '');
    setIsEffective(row.isEffective ?? true);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!submitRow || !actionText.trim()) return;
    setSubmitSaving(true); setSubmitError(null);
    try {
      await submitCapaAssessmentApi(submitRow.id, {
        actionObserved: actionText.trim(),
        evidenceRef:    evidenceRef.trim() || null,
        isEffective:    isEffective,
      });
      setSubmitRow(null);
      await fetch();
      onUpdated?.();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit assessment.');
    } finally {
      setSubmitSaving(false);
    }
  };

  const openReview = (row, decision) => {
    setReviewRow(row);
    setReviewDecision(decision);
    setReviewComment('');
    setReviewError(null);
  };

  const handleReview = async () => {
    if (!reviewRow || !reviewComment.trim()) return;
    setReviewSaving(true); setReviewError(null);
    try {
      await reviewCapaAssessmentApi(reviewRow.id, {
        decision: reviewDecision,
        comment:  reviewComment.trim(),
      });
      setReviewRow(null);
      await fetch();
      onUpdated?.();
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to record review.');
    } finally {
      setReviewSaving(false);
    }
  };

  const statusColor = (s) => {
    switch (s) {
      case 'ACCEPTED':  return 'success';
      case 'REJECTED':  return 'error';
      case 'SUBMITTED': return 'warning';
      default:          return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                    letterSpacing={0.5} color="text.secondary" sx={{ flex: 1 }}>
          Effectiveness Assessment Cycles
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetch}>
            <RefreshIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : rows.length === 0 ? (
        <Alert severity="info">
          No effectiveness-assessment cycles are scheduled. Head QA chose
          assessment_count = 0 at closure (or this CAPA was closed before
          the effectiveness lifecycle was introduced).
        </Alert>
      ) : (
        <Stack spacing={1}>
          {rows.map((r) => (
            <Box key={r.id} sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1.5,
                p: 1.2,
                bgcolor: r.status === 'ACCEPTED' ? 'success.50' :
                         r.status === 'REJECTED' ? 'error.50'   :
                         r.status === 'SUBMITTED'? 'warning.50' :
                                                    'background.paper',
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Cycle #{r.sequenceNo}
                  {r.dueDate && <Typography component="span" variant="caption"
                                            color="text.secondary" sx={{ ml: 0.5 }}>
                    · due {r.dueDate}
                  </Typography>}
                </Typography>
                <Chip size="small" label={r.status} color={statusColor(r.status)} />
                {r.completedByName && (
                  <Typography variant="caption" color="text.secondary">
                    by <strong>{r.completedByName}</strong>
                    {r.completedAt ? ` · ${formatDateTime(r.completedAt)}` : ''}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                {/* Submit / re-submit (PENDING or REJECTED rows) */}
                {(r.status === 'PENDING' || r.status === 'REJECTED') && (
                  <Tooltip title={r.status === 'REJECTED'
                      ? 'Re-submit this cycle (rejected by QA)'
                      : 'Fill this assessment cycle'}>
                    <IconButton size="small" color="primary" onClick={() => openSubmit(r)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {/* QA review buttons (SUBMITTED rows) */}
                {r.status === 'SUBMITTED' && (
                  <>
                    <Tooltip title="Accept this cycle">
                      <IconButton size="small" color="success"
                                  onClick={() => openReview(r, 'ACCEPTED')}>
                        <ApproveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reject and request re-submission">
                      <IconButton size="small" color="error"
                                  onClick={() => openReview(r, 'REJECTED')}>
                        <RejectIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
              {r.actionObserved && (
                <Typography variant="body2" sx={{ mt: 0.6, whiteSpace: 'pre-wrap' }}>
                  <strong>Observed:</strong> {r.actionObserved}
                </Typography>
              )}
              {r.evidenceRef && (
                <Typography variant="caption" color="text.secondary">
                  Evidence: {r.evidenceRef}
                </Typography>
              )}
              {r.reviewComment && (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  <strong>QA Review ({r.reviewStatus}):</strong> {r.reviewComment}
                  {r.reviewedByName && (
                    <Typography component="span" variant="caption"
                                color="text.secondary" sx={{ ml: 0.5 }}>
                      — {r.reviewedByName}
                      {r.reviewedAt ? ` · ${formatDateTime(r.reviewedAt)}` : ''}
                    </Typography>
                  )}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* Submit-cycle dialog */}
      <Dialog open={!!submitRow} onClose={() => setSubmitRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleSubmit(); } }}>
        <DialogTitle>Cycle #{submitRow?.sequenceNo} — submit assessment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
          <TextField label="Action Observed" required multiline rows={4} fullWidth
                     value={actionText} onChange={(e) => setActionText(e.target.value)}
                     placeholder="What did you observe? Was the corrective action effective?"
                     sx={{ mb: 2 }} inputProps={{ autoComplete: 'off' }} />
          <TextField label="Evidence Reference" fullWidth
                     value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)}
                     placeholder="DMS document #, photo file, etc."
                     sx={{ mb: 1 }} inputProps={{ autoComplete: 'off' }} />
          <FormControlLabel
            control={<Switch checked={isEffective}
                              onChange={(e) => setIsEffective(e.target.checked)} />}
            label={isEffective ? 'CAPA is effective for this cycle' : 'CAPA is NOT effective'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSubmitRow(null)} disabled={submitSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={submitSaving || !actionText.trim()}>
            {submitSaving ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review-cycle dialog */}
      <Dialog open={!!reviewRow} onClose={() => setReviewRow(null)} maxWidth="sm" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleReview(); } }}>
        <DialogTitle>
          Cycle #{reviewRow?.sequenceNo} — {reviewDecision === 'ACCEPTED' ? 'accept' : 'reject'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {reviewError && <Alert severity="error" sx={{ mb: 2 }}>{reviewError}</Alert>}
          <Alert severity={reviewDecision === 'ACCEPTED' ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {reviewDecision === 'ACCEPTED'
              ? 'Accepting this cycle locks the dept submission. When every cycle is ACCEPTED, the CAPA reaches EFFECTIVENESS_VERIFIED.'
              : 'Rejecting sends the cycle back to the responsible department for re-submission.'}
          </Alert>
          <TextField label="Review Comment" required multiline rows={3} fullWidth
                     value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReviewRow(null)} disabled={reviewSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  color={reviewDecision === 'ACCEPTED' ? 'success' : 'error'}
                  disabled={reviewSaving || !reviewComment.trim()}>
            {reviewSaving ? 'Saving…' : (reviewDecision === 'ACCEPTED' ? 'Accept' : 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QmsCapaAssessmentsSection;
