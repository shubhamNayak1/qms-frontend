import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, Typography, Box,
  Chip, Divider, Stack, IconButton, Tooltip, MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  Refresh as RefreshIcon,
  Assignment as ComplianceIcon,
  HowToReg as HRIcon,
  VerifiedUser as QAIcon,
} from '@mui/icons-material';
import {
  getEnrollmentByIdApi,
  getComplianceApi,
  submitComplianceApi,
  reviewComplianceApi,
  hrReviewComplianceApi,
  qaApproveComplianceApi,
} from '../../api/lmsApi';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS } from './lmsConstants';
import { formatDate } from '../../utils/helpers';

// ── helpers ───────────────────────────────────────────────────────────────────
const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={ENROLLMENT_STATUS_LABELS[status] || status?.replace(/_/g, ' ') || '—'}
    color={ENROLLMENT_STATUS_COLORS[status] || 'default'}
  />
);

const InfoRow = ({ label, value }) =>
  value ? (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
        {label}
      </Typography>
      <Typography variant="caption" fontWeight={600}>{value}</Typography>
    </Box>
  ) : null;

const SectionTitle = ({ children }) => (
  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
    {children}
  </Typography>
);

// ── QnA pair editor ───────────────────────────────────────────────────────────
const QnaEditor = ({ items, onChange }) => {
  const add = () => onChange([...items, { question: '', answer: '' }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, val) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          Q&A ANSWERS (optional)
        </Typography>
        <Button size="small" onClick={add}>+ Add Q&A</Button>
      </Box>
      {items.map((it, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            label="Question" size="small" sx={{ flex: 1 }} value={it.question}
            onChange={(e) => update(i, 'question', e.target.value)}
          />
          <TextField
            label="Answer" size="small" sx={{ flex: 1 }} value={it.answer}
            onChange={(e) => update(i, 'answer', e.target.value)}
          />
          <Tooltip title="Remove">
            <IconButton size="small" onClick={() => remove(i)}>
              <FailIcon fontSize="small" color="error" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
};

// ── Decision form (used for coordinator / HR / QA review panels) ──────────────
const DecisionForm = ({ label, onSubmit, busy, requireTni = false }) => {
  const [decision,  setDecision]  = useState('APPROVED');
  const [comments,  setComments]  = useState('');
  const [tniData,   setTniData]   = useState('');
  const [err,       setErr]       = useState(null);

  const handleSubmit = async () => {
    setErr(null);
    try {
      const payload = { decision, comments };
      if (requireTni && decision === 'APPROVED' && tniData.trim()) {
        payload.tniData = { notes: tniData };
      }
      await onSubmit(payload);
    } catch (e) {
      setErr(e.response?.data?.message || 'Action failed.');
    }
  };

  return (
    <Box>
      <TextField
        label="Decision" select size="small" fullWidth sx={{ mb: 1.5 }}
        value={decision} onChange={(e) => setDecision(e.target.value)}
      >
        <MenuItem value="APPROVED">✅ Approved</MenuItem>
        <MenuItem value="REJECTED">❌ Rejected</MenuItem>
      </TextField>
      <TextField
        label="Comments" multiline rows={2} fullWidth size="small" sx={{ mb: 1.5 }}
        value={comments} onChange={(e) => setComments(e.target.value)}
        placeholder="Add comments or reason for rejection…"
      />
      {requireTni && decision === 'APPROVED' && (
        <TextField
          label="TNI Data / Notes (optional)" multiline rows={2} fullWidth size="small" sx={{ mb: 1.5 }}
          value={tniData} onChange={(e) => setTniData(e.target.value)}
          helperText="Training Need Identification — auto-generated on final QA approval"
        />
      )}
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      <Button
        variant="contained"
        color={decision === 'APPROVED' ? 'success' : 'error'}
        onClick={handleSubmit}
        disabled={busy}
        startIcon={busy ? <CircularProgress size={14} /> : decision === 'APPROVED' ? <PassIcon /> : <FailIcon />}
        fullWidth
      >
        {busy ? 'Submitting…' : `${label} — ${decision === 'APPROVED' ? 'Approve' : 'Reject'}`}
      </Button>
    </Box>
  );
};

// ── Main Dialog ───────────────────────────────────────────────────────────────
const ComplianceDialog = ({ open, onClose, enrollmentId, onUpdated }) => {
  const [enrollment, setEnrollment] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(null);

  // Submit form state
  const [attachmentKey, setAttachmentKey] = useState('');
  const [qnaItems,      setQnaItems]      = useState([]);

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError(null);
    try {
      const [eRes, cRes] = await Promise.allSettled([
        getEnrollmentByIdApi(enrollmentId),
        getComplianceApi(enrollmentId),
      ]);
      if (eRes.status === 'fulfilled') {
        setEnrollment(eRes.value.data?.data || eRes.value.data);
      }
      if (cRes.status === 'fulfilled') {
        setCompliance(cRes.value.data?.data || cRes.value.data || null);
      } else {
        setCompliance(null);
      }
    } catch {
      setError('Failed to load enrollment details.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    if (open) {
      load();
      setSuccess(null);
      setError(null);
      setAttachmentKey('');
      setQnaItems([]);
    }
  }, [open, load]);

  const handleAction = async (apiFn, successMsg) => {
    setBusy(true);
    setError(null);
    try {
      await apiFn();
      setSuccess(successMsg);
      await load();
      onUpdated?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitCompliance = async () => {
    if (!attachmentKey.trim()) {
      setError('Attachment / evidence reference is required.');
      return;
    }
    const payload = {
      attachmentStorageKey: attachmentKey.trim(),
      qnaAnswers: qnaItems.filter((q) => q.question && q.answer),
    };
    await handleAction(
      () => submitComplianceApi(enrollmentId, payload),
      'Compliance submitted successfully. Awaiting coordinator review.'
    );
  };

  const handleReview = async ({ decision, comments }) => {
    await handleAction(
      () => reviewComplianceApi(enrollmentId, { decision, comments }),
      decision === 'APPROVED'
        ? 'Approved! Enrollment progressing to next stage.'
        : 'Rejected. Retraining enrollment will be created.'
    );
  };

  const handleHrReview = async ({ decision, comments }) => {
    await handleAction(
      () => hrReviewComplianceApi(enrollmentId, { decision, comments }),
      decision === 'APPROVED'
        ? 'HR approved. Awaiting QA Head approval.'
        : 'HR rejected. Retraining enrollment will be created.'
    );
  };

  const handleQaApprove = async ({ decision, comments, tniData }) => {
    await handleAction(
      () => qaApproveComplianceApi(enrollmentId, { decision, comments, tniData }),
      decision === 'APPROVED'
        ? '✅ QA approved! Enrollment COMPLETED. Certificate & TNI issued.'
        : 'QA rejected. Retraining enrollment will be created.'
    );
  };

  const status      = enrollment?.status;
  const trainingType = enrollment?.trainingType || enrollment?.programTrainingType;
  const isInduction = trainingType === 'INDUCTION';
  const examEnabled = enrollment?.examEnabled || enrollment?.programExamEnabled;

  // Determine what action panel to show
  const renderActionPanel = () => {
    if (loading) return null;
    if (success) return <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>;

    if (status === 'IN_PROGRESS') {
      if (compliance) {
        // Already submitted — compliance record exists, probably in another pending state or re-fetch issue
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            Compliance already submitted. Awaiting reviewer.
          </Alert>
        );
      }
      return (
        <Box sx={{ mt: 2 }}>
          <SectionTitle>📋 Submit Compliance Evidence</SectionTitle>
          <TextField
            label="Attachment / Evidence Reference *"
            fullWidth size="small" sx={{ mb: 1.5 }}
            value={attachmentKey}
            onChange={(e) => setAttachmentKey(e.target.value)}
            placeholder="e.g. ATTACH-2024-001 or storage key / document reference"
            helperText="Enter the document reference, storage key, or evidence identifier"
          />
          <QnaEditor items={qnaItems} onChange={setQnaItems} />
          {error && <Alert severity="error" sx={{ mt: 1.5, mb: 1 }}>{error}</Alert>}
          <Button
            variant="contained"
            fullWidth sx={{ mt: 1.5 }}
            onClick={handleSubmitCompliance}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} /> : <ComplianceIcon />}
          >
            {busy ? 'Submitting…' : 'Submit Compliance Evidence'}
          </Button>
        </Box>
      );
    }

    if (status === 'PENDING_REVIEW') {
      return (
        <Box sx={{ mt: 2 }}>
          <SectionTitle>🔍 Coordinator / Trainer Review</SectionTitle>
          {compliance && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Trainee Submission</Typography>
              <Typography variant="caption" fontWeight={600} display="block">
                Attachment: {compliance.attachmentStorageKey || '—'}
              </Typography>
              {compliance.submittedAt && (
                <Typography variant="caption" color="text.secondary">
                  Submitted: {formatDate(compliance.submittedAt)}
                </Typography>
              )}
              {compliance.qnaAnswers?.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {compliance.qnaAnswers.map((qa, i) => (
                    <Box key={i} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={600}>Q: {qa.question}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">A: {qa.answer}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <DecisionForm
            label="Coordinator Review"
            onSubmit={handleReview}
            busy={busy}
          />
          {isInduction && (
            <Alert severity="info" sx={{ mt: 1.5 }} icon={<HRIcon />}>
              <strong>Induction Program:</strong> If approved, will proceed to HR Review → QA Approval.
            </Alert>
          )}
        </Box>
      );
    }

    if (status === 'PENDING_HR_REVIEW') {
      return (
        <Box sx={{ mt: 2 }}>
          <SectionTitle>👤 HR Review (Induction)</SectionTitle>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Coordinator has approved. HR review is required for Induction training.
          </Alert>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <DecisionForm label="HR Review" onSubmit={handleHrReview} busy={busy} />
        </Box>
      );
    }

    if (status === 'PENDING_QA_APPROVAL') {
      return (
        <Box sx={{ mt: 2 }}>
          <SectionTitle>🔐 QA Head Final Approval (Induction)</SectionTitle>
          <Alert severity="warning" sx={{ mb: 1.5 }} icon={<QAIcon />}>
            <strong>Final step:</strong> QA approval will mark enrollment COMPLETED, issue certificate, and generate TNI.
          </Alert>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <DecisionForm label="QA Approval" onSubmit={handleQaApprove} busy={busy} requireTni />
        </Box>
      );
    }

    if (status === 'COMPLETED') {
      return (
        <Alert severity="success" sx={{ mt: 2 }} icon={<PassIcon />}>
          <strong>Completed!</strong> Training compliance is done.
          {examEnabled && ' Certificate has been issued.'}
          {isInduction && ' TNI has been auto-generated.'}
        </Alert>
      );
    }

    if (status === 'FAILED') {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>Failed.</strong> A new retraining enrollment has been automatically created.
        </Alert>
      );
    }

    if (status === 'RETRAINING') {
      return (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Retraining required.</strong> This enrollment was created as a retraining record.
          Complete the compliance process again.
        </Alert>
      );
    }

    if (status === 'ALLOCATED') {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Enrollment is allocated. Attendance must be marked first to move to IN_PROGRESS.
        </Alert>
      );
    }

    if (status === 'WAIVED') {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          This enrollment has been <strong>waived</strong>. No compliance action needed.
        </Alert>
      );
    }

    if (status === 'CANCELLED') {
      return (
        <Alert severity="warning" sx={{ mt: 2 }}>
          This enrollment has been <strong>cancelled</strong>.
        </Alert>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ComplianceIcon color="primary" />
        Compliance Workflow
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && enrollment && (
          <>
            {/* Enrollment Summary */}
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <StatusChip status={status} />
                {isInduction && <Chip label="Induction" size="small" color="secondary" variant="outlined" />}
                {examEnabled && <Chip label="Exam Required" size="small" color="primary" variant="outlined" />}
              </Box>
              <InfoRow label="Trainee"         value={enrollment.userName} />
              <InfoRow label="Department"      value={enrollment.userDepartment} />
              <InfoRow label="Program"         value={enrollment.programTitle || enrollment.programCode} />
              <InfoRow label="Due Date"        value={formatDate(enrollment.dueDate)} />
              {enrollment.overdue && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>⚠ Overdue</Alert>
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Compliance Timeline */}
            {isInduction && (
              <>
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Induction Approval Chain
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                    {[
                      { label: 'Submit',     active: ['PENDING_REVIEW','PENDING_HR_REVIEW','PENDING_QA_APPROVAL','COMPLETED'].includes(status) },
                      { label: 'Coordinator',active: ['PENDING_HR_REVIEW','PENDING_QA_APPROVAL','COMPLETED'].includes(status) },
                      { label: 'HR Review',  active: ['PENDING_QA_APPROVAL','COMPLETED'].includes(status) },
                      { label: 'QA Approval',active: ['COMPLETED'].includes(status) },
                    ].map(({ label, active }) => (
                      <Chip
                        key={label}
                        label={label}
                        size="small"
                        color={active ? 'success' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        icon={active ? <PassIcon style={{ fontSize: 12 }} /> : undefined}
                      />
                    ))}
                  </Stack>
                </Box>
                <Divider sx={{ my: 1.5 }} />
              </>
            )}

            {/* Action Panel */}
            {renderActionPanel()}

            {/* Exam notification */}
            {examEnabled && status === 'IN_PROGRESS' && compliance && (
              <Alert severity="info" sx={{ mt: 1.5 }} icon={<PassIcon />}>
                <strong>Exam Enabled:</strong> After compliance is approved, you'll be notified to take the online MCQ exam.
              </Alert>
            )}
          </>
        )}

        {!loading && !enrollment && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No enrollment data found.
          </Typography>
        )}
        {!loading && error && !enrollment && (
          <Alert severity="error">{error}</Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ComplianceDialog;
