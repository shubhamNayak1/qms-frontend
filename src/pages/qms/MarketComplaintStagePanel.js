import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
} from '@mui/icons-material';
import {
  updateComplaintApi, approveComplaintApi, rejectComplaintApi,
  closeComplaintApi, transitionComplaintApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';

/**
 * MarketComplaintStagePanel — stage-aware editable form for Market Complaint.
 *
 * The MC workflow per Kedar-sir spec:
 *   DRAFT
 *     → PENDING_HOD          (HOD adds review comment only — no dept routing)
 *     → PENDING_INVESTIGATION (QA Reviewer's hub)
 *         ↔ PENDING_DEPT_COMMENT (QA invites depts; loops back when complete)
 *     → PENDING_HEAD_QA       (Head QA verifies)
 *     → CLOSED                (Head QA closes; gated by 45-day SLA on backend)
 *
 * The PENDING_INVESTIGATION step has TWO primary actions:
 *   • "Invite Departments" → PENDING_DEPT_COMMENT (use the dept-comments
 *     accordion to add the actual depts before clicking forward)
 *   • "Forward to Head QA" → PENDING_HEAD_QA (canonical advance)
 *
 * The PENDING_DEPT_COMMENT step shows progress (X/Y completed) and disables
 * the "Back to Investigation" forward button until every dept has filled.
 */

const STAGE_DESCRIPTORS = {
  PENDING_HOD: {
    title: 'HOD Assessment',
    actor: 'Head of Department (complainant\'s dept)',
    helper: 'Review the complaint details and attachments. Add a review comment, then approve to forward to QA Investigation.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward to QA Investigation',
  },
  PENDING_INVESTIGATION: {
    title: 'QA Investigation',
    actor: 'QA Reviewer',
    helper:
      'Carry out the impact assessment + detailed investigation. Decide whether a CAPA is required and, if so, link it. Use the Department-Wise Comments accordion below to invite cross-functional comments — once every requested dept has filled their row, this record loops back here for your forward.',
    fields: [
      'impactAssessment',
      'investigationFindings',
      'capaRequired',
      'capaReference',
    ],
    primary: 'approve',
    primaryLabel: 'Forward to Head QA',
    // Secondary action — invite departments. Routes to PENDING_DEPT_COMMENT.
    secondary: { kind: 'transition', target: 'PENDING_DEPT_COMMENT', label: 'Invite Departments for Comment' },
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each invited department',
    helper:
      'Each invited department\'s HOD fills their feedback in the Department-Wise Comments accordion below. When every row is COMPLETED, the QA Reviewer clicks "Back to QA Investigation" to resume.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Back to QA Investigation',
    secondary: null,
  },
  PENDING_HEAD_QA: {
    title: 'Head QA Verification',
    actor: 'Head of QA',
    helper:
      'Verify the QA investigation findings and the customer feedback (if any). Print the complaint dossier for the customer if needed. Closure must happen within 45 days from creation; if you\'re past that window, an approved target-date extension is required.',
    fields: ['customerResponse', 'customerSatisfied', 'resolutionDetails'],
    primary: 'close',
    primaryLabel: 'Close Market Complaint',
    secondary: { kind: 'transition', target: 'PENDING_INVESTIGATION', label: 'Send back to QA' },
  },
};

// ── Field renderer ─────────────────────────────────────────────────
const FieldEditor = ({ name, form, setForm }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'impactAssessment':
      return (
        <Grid item xs={12}>
          <TextField label="Impact Assessment" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="What's the impact of this complaint? Affected batches, regulatory exposure, customer impact, etc."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'investigationFindings':
      return (
        <Grid item xs={12}>
          <TextField label="Investigation Findings" multiline rows={4} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Root cause, evidence, lab results, observations…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'capaRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="CAPA Required"
          />
        </Grid>
      );
    case 'capaReference':
      return form.capaRequired ? (
        <Grid item xs={6}>
          <TextField label="Linked CAPA #" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="e.g. CAPA-202504-0007"
                     helperText="Tie this complaint to its corrective-action record."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'customerResponse':
      return (
        <Grid item xs={12}>
          <TextField label="Customer Response / Feedback" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Pasted from the printed dossier the customer signed off on."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'customerSatisfied':
      return (
        <Grid item xs={6}>
          <TextField label="Customer Satisfied?" select fullWidth value={v === '' ? '' : (v ? 'YES' : 'NO')}
                     onChange={(e) => set(e.target.value === 'YES')}>
            <MenuItem value=""><em>—</em></MenuItem>
            <MenuItem value="YES">Yes</MenuItem>
            <MenuItem value="NO">No</MenuItem>
          </TextField>
        </Grid>
      );
    case 'resolutionDetails':
      return (
        <Grid item xs={12}>
          <TextField label="Resolution Details" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Final resolution narrative recorded on the printed cover sheet."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

// ──────────────────────────────────────────────────────────────────
const MarketComplaintStagePanel = ({ record, onUpdated }) => {
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]       = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError]     = useState(null);

  // Department-comment progress — pulled while at PENDING_DEPT_COMMENT so we
  // can block "Back to QA Investigation" until every requested dept has filled.
  const [deptComments, setDeptComments] = useState([]);

  useEffect(() => {
    if (!record || !desc) { setForm({}); setComment(''); return; }
    const BOOL_FIELDS = new Set(['capaRequired', 'customerSatisfied']);
    const fresh = {};
    desc.fields.forEach((f) => {
      fresh[f] = record[f] ?? (BOOL_FIELDS.has(f) ? false : '');
    });
    setForm(fresh);
    setComment('');
    setError(null);
  }, [record?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'PENDING_DEPT_COMMENT' || !record?.id) {
      setDeptComments([]);
      return;
    }
    listDeptCommentsApi('market-complaint', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);

  if (!desc) return null;

  const deptPending     = deptComments.filter((r) => r.status === 'PENDING').length;
  const deptTotal       = deptComments.length;
  const deptCompleted   = deptTotal - deptPending;
  const isDeptCommentStage = status === 'PENDING_DEPT_COMMENT';
  const blockForward       = isDeptCommentStage && deptPending > 0;

  // 45-day SLA banner — purely informational. Backend enforces close.
  const ageDays = record?.createdAt
    ? Math.floor((Date.now() - new Date(record.createdAt).getTime()) / (24 * 3600 * 1000))
    : null;
  const isLate = ageDays != null && ageDays > 45;
  const extApproved = (record?.targetDateExtensionStatus || '').toUpperCase() === 'APPROVED';
  const showSlaWarning = isLate && status !== 'CLOSED' && status !== 'CANCELLED' && !extApproved;

  const submit = async (action) => {
    if (!record) return;
    setError(null);

    if (!comment.trim()) {
      setError('A comment is required for this action — it is recorded on the audit trail.');
      return;
    }

    const flag = action === 'reject' ? setRejecting : setSaving;
    flag(true);
    try {
      // Step 1 — persist field updates if any.
      if (desc.fields.length > 0) {
        const payload = {
          title:    record.title,
          priority: record.priority,
          ...form,
        };
        await updateComplaintApi(record.id, payload);
      }

      // Step 2 — workflow transition.
      switch (action) {
        case 'approve':
          await approveComplaintApi(record.id, comment.trim());
          break;
        case 'close':
          await closeComplaintApi(record.id, comment.trim());
          break;
        case 'reject':
          await rejectComplaintApi(record.id, comment.trim());
          break;
        case 'resend':
          // PENDING_HOD → DRAFT (Resend to Initiator). Distinct from REJECTED.
          await transitionComplaintApi(record.id, {
            targetStatus: 'DRAFT',
            comment: comment.trim(),
          });
          break;
        case 'transition':
          await transitionComplaintApi(record.id, {
            targetStatus: desc.secondary.target,
            comment: comment.trim(),
          });
          break;
        default:
          throw new Error('Unknown action');
      }
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      flag(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{
        p: 2, mb: 2, borderLeft: '4px solid', borderLeftColor: 'primary.main',
        borderRadius: 1.5,
      }}>
      <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>{desc.title}</Typography>
        <Typography variant="caption" color="text.secondary">· {desc.actor}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {desc.helper}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {showSlaWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This complaint is <strong>{ageDays} days old</strong> — past the 45-day SLA.
          Closure is blocked until a target-date extension is approved by Head QA.
          Use the <em>Target Date Extension</em> panel below.
        </Alert>
      )}

      {isDeptCommentStage && (
        <Alert severity={blockForward ? 'warning' : 'success'} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2">
              Department comments: <strong>{deptCompleted}</strong>/<strong>{deptTotal || 0}</strong> completed
            </Typography>
            {deptTotal === 0 && <Chip size="small" label="No departments invited yet" />}
            {blockForward && (
              <Typography variant="caption" color="text.secondary">
                · Each invited dept HOD must fill their row before this can be sent back to QA Investigation.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {desc.fields.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {desc.fields.map((f) => (
            <FieldEditor key={f} name={f} form={form} setForm={setForm} />
          ))}
        </Grid>
      )}

      <TextField
        label="Remark / Justification" required multiline rows={2} fullWidth
        value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Recorded on the audit trail as the actor's remark for this transition."
        sx={{ mb: 1.5 }}
        inputProps={{ autoComplete: 'off' }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Tooltip title={blockForward
            ? `Cannot advance — ${deptPending} department comment(s) still pending`
            : `POST .../${desc.primary}?comment=…`}>
          <span>
            <Button
              variant="contained"
              startIcon={desc.primary === 'close' ? <SaveIcon /> : <ForwardIcon />}
              color={desc.primary === 'close' ? 'success' : 'primary'}
              onClick={() => submit(desc.primary)}
              disabled={saving || rejecting || !comment.trim() || blockForward}
            >
              {saving ? 'Saving…' : desc.primaryLabel}
            </Button>
          </span>
        </Tooltip>

        {desc.secondary && (
          <Button variant="outlined" onClick={() => submit('transition')}
                  disabled={saving || rejecting || !comment.trim()}>
            {desc.secondary.label}
          </Button>
        )}

        {/* HOD-only Resend button — distinct from Reject. Record returns
            to DRAFT so the Initiator can edit + re-submit. */}
        {status === 'PENDING_HOD' && (
          <Tooltip title="Send back to Initiator — record returns to DRAFT (not REJECTED)">
            <span>
              <Button variant="outlined" color="warning"
                      onClick={() => submit('resend')}
                      disabled={saving || rejecting || !comment.trim()}>
                Resend to Initiator
              </Button>
            </span>
          </Tooltip>
        )}

        <Tooltip title="POST .../reject?comment=…">
          <span>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => submit('reject')}
              disabled={saving || rejecting || !comment.trim()}
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
};

export default MarketComplaintStagePanel;
