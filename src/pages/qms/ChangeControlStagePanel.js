import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
  Undo as ResendIcon, History as HistoryIcon,
} from '@mui/icons-material';
import {
  updateChangeControlApi, approveChangeControlApi, rejectChangeControlApi,
  closeChangeControlApi, transitionChangeControlApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi, listLineItemsApi } from '../../api/qmsCommonApi';
import { formatDateTime } from '../../utils/helpers';

/**
 * ChangeControlStagePanel — May 2026 tester rebuild.
 *
 * Notable per-stage rules from the tester walkthrough:
 *
 *   PENDING_HOD ("HOD Assessment")
 *     • Read-only context block listing EVERYTHING the Initiator entered
 *       (title, dept, dates, product name + code, change type, line items
 *       with Existing/Proposed/Justification, the Initiator's attachment).
 *     • HOD writes Initial Assessment (renamed from Risk Assessment).
 *     • Three buttons: Approve & forward to QA · Resend to Initiator · Reject.
 *       Resend bounces the record back to DRAFT and increments resend_count
 *       — distinct from Reject which terminates the record.
 *     • Linked CAPA is removed at this stage per tester feedback.
 *
 *   PENDING_QA_REVIEW ("QA Evaluation")
 *     • Two-phase form, same status:
 *         Phase 1 — no dept comments returned yet. QA captures CC Type
 *                   (= Risk Level, Critical/Major/Minor) + Pre-Remark
 *                   + invites departments. Save blocks until at least one
 *                   dept has been invited.
 *         Phase 2 — at least one dept comment has been COMPLETED. QA fills
 *                   QA Evaluation Remark + Risk Assessment Req/Not (with
 *                   conditional narrative) + Site Head Req + Customer
 *                   Communication Req + Regulatory Assessment Req.
 *     • The label "QA Evaluation" is used everywhere — no more "QA Review".
 *
 *   All other stages keep their existing fields but the audit-comment
 *   label is "Remark / Justification" everywhere.
 */

// ── Stage descriptors ───────────────────────────────────────────────
const STAGE_DESCRIPTORS = {
  PENDING_HOD: {
    title: 'HOD Assessment',
    actor: 'Department Head of Department',
    helper: 'Review every field the Initiator captured below, then write your Initial Assessment. Three outcomes: forward to QA, send back to Initiator for revision, or reject.',
    fields: ['initialAssessment'],
    requiredFields: ['initialAssessment'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to QA Evaluation',
  },
  PENDING_QA_REVIEW: {
    title: 'QA Evaluation',
    actor: 'QA Reviewer',
    helper: '(See phase-specific helper text below.)',
    // Field list is driven by phase — handled in render
    primary: 'approve',
    primaryLabel: 'Approve & forward to Dept Comments',
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each requested department',
    helper: 'Each requested dept HOD fills their comment in the accordion below — including Remark, Action / Activity Required, and (when required) Target Date. Once all are complete the QA Reviewer forwards to RA Evaluation.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Forward to RA Evaluation',
    secondary: { kind: 'transition', target: 'PENDING_QA_REVIEW', label: 'Send back to QA' },
  },
  PENDING_RA_REVIEW: {
    title: 'RA Evaluation',
    actor: 'RA Head',
    helper: 'Categorise the change and capture the regulatory submission decision.',
    fields: ['category', 'regulatorySubmissionRequired', 'regulatorySubmissionReference'],
    requiredFields: ['category'],
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_SITE_HEAD: {
    title: 'Site Head Concurrence',
    actor: 'Site Head',
    helper: 'Record the Site Head\'s concurrence remark and forward.',
    fields: ['comments'],
    requiredFields: ['comments'],
    primary: 'approve',
    primaryLabel: 'Concurrence & forward to Head QA',
  },
  PENDING_CUSTOMER_COMMENT: {
    title: 'Customer Approval',
    actor: 'Customer Representative',
    helper: 'Capture the Customer Representative\'s details and their feedback comment, then forward.',
    fields: ['customerRepresentative', 'customerComment'],
    requiredFields: ['customerRepresentative', 'customerComment'],
    primary: 'approve',
    primaryLabel: 'Forward to Head QA',
  },
  PENDING_HEAD_QA: {
    title: 'Approval by Head QA',
    actor: 'Head of QA',
    helper: 'Record the final approval narrative and decide.',
    fields: ['approvalComments'],
    requiredFields: ['approvalComments'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Verification',
  },
  PENDING_VERIFICATION: {
    title: 'Verification of Change Implementation',
    actor: 'Initiator → Manager QA → Head QA',
    helper: 'Initiator fills Action Taken / Effective On for each line item. Manager QA reviews — Head QA closes the record.',
    fields: [
      'verificationActionTaken', 'verificationEffectiveOn',
      'verificationDocumentsReissue', 'verificationOtherComments',
      'verificationRegCommunication',
    ],
    requiredFields: ['verificationActionTaken', 'verificationEffectiveOn'],
    primary: 'close',
    primaryLabel: 'Close Change Control',
  },
};

// Friendly labels for the required-field error message
const FIELD_LABELS = {
  initialAssessment: 'Initial Assessment',
  category: 'Change Control Type',
  preRemark: 'Pre-Remark',
  qaEvalRemark: 'QA Evaluation Remark',
  comments: 'Comments / Concurrence',
  customerRepresentative: 'Customer Representative',
  customerComment: 'Customer Comments',
  approvalComments: 'Approval Comments',
  verificationActionTaken: 'Action Taken / Documents Closed',
  verificationEffectiveOn: 'Effective / Implemented On',
};

// ── Read-only Initiator context — shown on EVERY downstream stage ──
const InitiatorContext = ({ record, lineItems }) => (
  <Alert severity="info" icon={false} sx={{ mb: 2 }}>
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4 }}>
      CAPTURED BY INITIATOR
    </Typography>
    <Grid container spacing={1} sx={{ mt: 0.5 }}>
      {record.recordNumber && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Record #:</strong> {record.recordNumber}</Typography>
        </Grid>
      )}
      {record.createdAt && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Date:</strong> {String(record.createdAt).slice(0, 10)}</Typography>
        </Grid>
      )}
      {record.department && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Department:</strong> {record.department}</Typography>
        </Grid>
      )}
      {record.productMaterial && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Product / Material:</strong> {record.productMaterial}</Typography>
        </Grid>
      )}
      {record.productMaterialCode && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Material Code:</strong> {record.productMaterialCode}</Typography>
        </Grid>
      )}
      {record.changeType && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Type:</strong> {record.changeType}</Typography>
        </Grid>
      )}
      {record.initialAttachmentDmsNumber && (
        <Grid item xs={12}>
          <Typography variant="body2">
            <strong>Attachment:</strong> {record.initialAttachmentDmsNumber} v{record.initialAttachmentDmsVersion || '?'}
            {record.initialAttachmentDmsTitle && ` · ${record.initialAttachmentDmsTitle}`}
          </Typography>
        </Grid>
      )}
      {!record.initialAttachmentDmsNumber && record.initialAttachmentRef && (
        <Grid item xs={12}>
          <Typography variant="body2"><strong>Attachment:</strong> {record.initialAttachmentRef}</Typography>
        </Grid>
      )}
    </Grid>

    {Array.isArray(lineItems) && lineItems.length > 0 && (
      <>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
          LINE ITEMS ({lineItems.length})
        </Typography>
        <Stack spacing={1}>
          {lineItems.map((li, idx) => (
            <Box key={li.id || idx} sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1,
                p: 1, bgcolor: 'background.paper',
              }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                #{idx + 1} {li.proposedDate && `· proposed ${li.proposedDate}`}
              </Typography>
              {li.existingSystem && (
                <Typography variant="body2" sx={{ mt: 0.3, whiteSpace: 'pre-wrap' }}>
                  <strong>Existing:</strong> {li.existingSystem}
                </Typography>
              )}
              {li.proposedSystem && (
                <Typography variant="body2" sx={{ mt: 0.2, whiteSpace: 'pre-wrap' }}>
                  <strong>Proposed:</strong> {li.proposedSystem}
                </Typography>
              )}
              {li.justification && (
                <Typography variant="body2" sx={{ mt: 0.2, whiteSpace: 'pre-wrap' }}>
                  <strong>Remark / Justification:</strong> {li.justification}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </>
    )}
  </Alert>
);

// ── Activity history timeline — for QA Evaluation ─────────────────
const ActivityHistory = ({ history, resendCount }) => {
  const [open, setOpen] = useState(false);
  const rows = Array.isArray(history) ? history : [];
  if (rows.length === 0) return null;
  return (
    <Alert severity="info" icon={false} sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <HistoryIcon fontSize="small" />
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
          ACTIVITY HISTORY · {rows.length} STEP{rows.length !== 1 ? 'S' : ''}
        </Typography>
        {resendCount > 0 && (
          <Chip size="small" color="warning" label={`Resent ${resendCount}×`} />
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => setOpen((v) => !v)}>
          {open ? 'Collapse' : 'Expand'}
        </Button>
      </Stack>
      {open && (
        <Stack spacing={0.8} sx={{ mt: 1 }}>
          {rows.map((h, i) => (
            <Box key={i} sx={{
                borderLeft: '3px solid',
                borderColor: h.toStatus === 'DRAFT' && h.fromStatus === 'PENDING_HOD'
                              ? 'warning.main' : 'primary.main',
                pl: 1.2, py: 0.4,
              }}>
              <Typography variant="caption" color="text.secondary">
                {h.timestamp && formatDateTime(h.timestamp)} · {h.actor || '—'}
              </Typography>
              <Typography variant="body2">
                <strong>{h.fromStatus} → {h.toStatus}</strong>
                {h.toStatus === 'DRAFT' && h.fromStatus === 'PENDING_HOD' && (
                  <Chip size="small" color="warning" label="RESEND" sx={{ ml: 0.5 }} />
                )}
              </Typography>
              {h.comment && (
                <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                  {h.comment}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Alert>
  );
};

// ── Field renderer ─────────────────────────────────────────────────
const FieldEditor = ({ name, form, setForm, xs = 12 }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'initialAssessment':
      return (
        <Grid item xs={xs}>
          <TextField label="Initial Assessment" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="HOD's initial assessment of the proposed change…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'category':
      // "Category" is the Change Control Type per tester spec — same values as
      // the old Risk Level (Critical / Major / Minor). Single source of truth.
      return (
        <Grid item xs={6}>
          <TextField label="Change Control Type" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     helperText="Critical / Major / Minor — same as Risk Level.">
            {['', 'Critical', 'Major', 'Minor'].map((c) => (
              <MenuItem key={c || '__'} value={c}>{c || <em>— select —</em>}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'regulatorySubmissionRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Regulatory Assessment Required"
          />
        </Grid>
      );
    case 'regulatorySubmissionReference':
      return form.regulatorySubmissionRequired ? (
        <Grid item xs={6}>
          <TextField label="Submission Reference / Dossier" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Dossier number, country, etc."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'comments':
      return (
        <Grid item xs={12}>
          <TextField label="Concurrence / Remark" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Recorded on the audit trail."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'customerRepresentative':
      return (
        <Grid item xs={6}>
          <TextField label="Customer Representative" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Customer's contact name"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'customerComment':
      return (
        <Grid item xs={12}>
          <TextField label="Customer Comments" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Customer's feedback on the proposed change"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'approvalComments':
      return (
        <Grid item xs={12}>
          <TextField label="Approval Comments" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Final approval narrative recorded on the printed CC form."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationActionTaken':
      return (
        <Grid item xs={12}>
          <TextField label="Action Taken / Documents Closed" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationEffectiveOn':
      return (
        <Grid item xs={6}>
          <TextField label="Effective / Implemented On" type="date" required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationDocumentsReissue':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Documents to be Reissued"
          />
        </Grid>
      );
    case 'verificationRegCommunication':
      return (
        <Grid item xs={12}>
          <TextField label="Communication to Reg. Department" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Date + document submission details"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationOtherComments':
      return (
        <Grid item xs={12}>
          <TextField label="Other Comments" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

// ── Main panel ─────────────────────────────────────────────────────
const ChangeControlStagePanel = ({ record, onUpdated }) => {
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]           = useState({});
  const [comment, setComment]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState(null);
  const [resendDialog, setResendDialog] = useState(false);

  const [deptComments, setDeptComments] = useState([]);
  const [lineItems, setLineItems]       = useState([]);

  // Two-phase QA Evaluation: Phase 2 is detected by ANY completed dept comment.
  const hasCompletedDeptComment = deptComments.some(d => d.status === 'COMPLETED');
  const qaPhase = (status === 'PENDING_QA_REVIEW' && hasCompletedDeptComment) ? 2 : 1;

  // ── Form state setup ────────────────────────────────────────────
  useEffect(() => {
    if (!record) { setForm({}); setComment(''); return; }
    // We carry every conceivable field — render filter happens in JSX
    // based on stage. Note that the "Initial Assessment" UI label maps to
    // the existing riskAssessment column on QmsRecord.
    const fresh = {
      initialAssessment:            record.riskAssessment ?? '',
      category:                     record.category ?? '',
      preRemark:                    record.preRemark ?? '',
      qaEvalRemark:                 record.comments ?? '',
      riskAssessmentRequired:       !!record.riskAssessment,
      riskAssessment:               record.riskAssessment ?? '',
      siteHeadRequired:             !!record.siteHeadRequired,
      customerCommunicationRequired:!!record.customerCommunicationRequired,
      regulatorySubmissionRequired: !!record.regulatorySubmissionRequired,
      regulatorySubmissionReference:record.regulatorySubmissionReference ?? '',
      customerRepresentative:       record.customerRepresentative ?? '',
      customerComment:              record.customerComment ?? '',
      comments:                     record.comments ?? '',
      approvalComments:             record.approvalComments ?? '',
      verificationActionTaken:      record.verificationActionTaken ?? '',
      verificationEffectiveOn:      record.verificationEffectiveOn ?? '',
      verificationDocumentsReissue: !!record.verificationDocumentsReissue,
      verificationOtherComments:    record.verificationOtherComments ?? '',
      verificationRegCommunication: record.verificationRegCommunication ?? '',
    };
    setForm(fresh);
    setComment('');
    setError(null);
  }, [record?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch dept comments (drives Phase 1 vs Phase 2 detection + dept-gate)
  useEffect(() => {
    if (!record?.id) { setDeptComments([]); return; }
    if (status !== 'PENDING_QA_REVIEW' && status !== 'PENDING_DEPT_COMMENT') {
      setDeptComments([]); return;
    }
    listDeptCommentsApi('change-control', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);

  // Fetch line items for the Initiator-context block (HOD + downstream)
  useEffect(() => {
    if (!record?.id || status === 'DRAFT') { setLineItems([]); return; }
    listLineItemsApi('change-control', record.id)
      .then(({ data }) => setLineItems(data?.data || []))
      .catch(() => setLineItems([]));
  }, [record?.id, status]);

  if (!desc) return null;

  const deptPending     = deptComments.filter((r) => r.status === 'PENDING').length;
  const deptTotal       = deptComments.length;
  const deptCompleted   = deptTotal - deptPending;
  const isDeptCommentStage = status === 'PENDING_DEPT_COMMENT';
  const blockForward       = isDeptCommentStage && deptPending > 0;

  // ── QA Evaluation phase-specific descriptors ──────────────────
  const qaPhase1Fields = ['category', 'preRemark'];
  const qaPhase1Required = ['category', 'preRemark'];
  const qaPhase2Fields = [
    'qaEvalRemark',
    'riskAssessmentRequired', 'riskAssessment',
    'siteHeadRequired', 'customerCommunicationRequired',
    'customerRepresentative',
    'regulatorySubmissionRequired', 'regulatorySubmissionReference',
  ];
  const qaPhase2Required = ['qaEvalRemark'];

  // Pick the field list + required-list based on current stage / phase
  let effectiveFields    = desc.fields || [];
  let effectiveRequired  = desc.requiredFields || [];
  let effectiveHelper    = desc.helper;

  if (status === 'PENDING_QA_REVIEW') {
    if (qaPhase === 1) {
      effectiveFields   = qaPhase1Fields;
      effectiveRequired = qaPhase1Required;
      effectiveHelper   = 'PHASE 1 — Set the Change Control Type and write a Pre-Remark visible to invited departments. Then invite the departments via the Department-Wise Comments accordion below and save.';
    } else {
      effectiveFields   = qaPhase2Fields;
      effectiveRequired = qaPhase2Required;
      effectiveHelper   = 'PHASE 2 — All invited departments have responded. Capture your QA Evaluation Remark, decide whether a Risk Assessment is required, and flip the Site Head / Customer Communication / Regulatory Assessment flags as appropriate, then forward.';
    }
  }

  // ── Submit ────────────────────────────────────────────────────
  const submit = async (action) => {
    if (!record) return;
    setError(null);

    if (!comment.trim()) {
      setError('A Remark / Justification is required for this action — it is recorded on the audit trail.');
      return;
    }

    if (action !== 'reject' && action !== 'resend') {
      // Required-field validation
      const missing = effectiveRequired.filter((f) => {
        // Risk Assessment narrative is conditionally required (Phase 2 only when toggle is YES)
        if (f === 'riskAssessment' && !form.riskAssessmentRequired) return false;
        const v = form[f];
        if (typeof v === 'boolean') return false;
        return v == null || (typeof v === 'string' && !v.trim());
      });
      // Phase-1 also requires at least one department invited
      if (status === 'PENDING_QA_REVIEW' && qaPhase === 1 && deptTotal === 0) {
        setError('Phase 1 requires at least one department to be invited via the Department-Wise Comments accordion below before saving.');
        return;
      }
      // Phase-2 conditional: when Risk Assessment Required = YES, narrative is mandatory
      if (status === 'PENDING_QA_REVIEW' && qaPhase === 2
          && form.riskAssessmentRequired && !form.riskAssessment?.trim()) {
        setError('Risk Assessment is set to Required — please write the assessment narrative before forwarding.');
        return;
      }
      if (missing.length > 0) {
        const labels = missing.map((f) => FIELD_LABELS[f] || f).join(', ');
        setError(`Please fill the required field(s) before forwarding: ${labels}.`);
        return;
      }
    }

    const flag = action === 'reject'  ? setRejecting
              : action === 'resend'   ? setResending
                                      : setSaving;
    flag(true);
    try {
      if (effectiveFields.length > 0 && action !== 'reject' && action !== 'resend') {
        // Map UI keys back onto backend column names where needed
        const payload = {
          title:    record.title,
          priority: record.priority,
        };
        if (status === 'PENDING_HOD') {
          payload.riskAssessment = form.initialAssessment;
        }
        if (status === 'PENDING_QA_REVIEW' && qaPhase === 1) {
          payload.category   = form.category;
          payload.preRemark  = form.preRemark;
          payload.riskLevel  = form.category; // mirror — same values
        }
        if (status === 'PENDING_QA_REVIEW' && qaPhase === 2) {
          payload.comments                     = form.qaEvalRemark;
          payload.riskAssessment               = form.riskAssessmentRequired ? form.riskAssessment : null;
          payload.siteHeadRequired             = !!form.siteHeadRequired;
          payload.customerCommunicationRequired= !!form.customerCommunicationRequired;
          payload.customerRepresentative       = form.customerRepresentative || null;
          payload.regulatorySubmissionRequired = !!form.regulatorySubmissionRequired;
          payload.regulatorySubmissionReference= form.regulatorySubmissionRequired
                                                  ? (form.regulatorySubmissionReference || null) : null;
        }
        if (status === 'PENDING_RA_REVIEW') {
          payload.category = form.category;
          payload.regulatorySubmissionRequired = !!form.regulatorySubmissionRequired;
          payload.regulatorySubmissionReference = form.regulatorySubmissionReference || null;
        }
        if (status === 'PENDING_SITE_HEAD' || status === 'PENDING_CUSTOMER_COMMENT'
            || status === 'PENDING_HEAD_QA' || status === 'PENDING_VERIFICATION') {
          // Pass through only the keys the stage owns
          effectiveFields.forEach((f) => { payload[f] = form[f]; });
        }
        await updateChangeControlApi(record.id, payload);
      }

      switch (action) {
        case 'approve':
          await approveChangeControlApi(record.id, comment.trim());
          break;
        case 'close':
          await closeChangeControlApi(record.id, comment.trim());
          break;
        case 'reject':
          await rejectChangeControlApi(record.id, comment.trim());
          break;
        case 'resend':
          // Resend = PENDING_HOD → DRAFT via the generic transition endpoint.
          await transitionChangeControlApi(record.id, {
            targetStatus: 'DRAFT',
            comment: comment.trim(),
          });
          break;
        case 'transition':
          await transitionChangeControlApi(record.id, {
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

  // Primary button label adapts at QA Phase 1
  let primaryLabel = desc.primaryLabel;
  if (status === 'PENDING_QA_REVIEW' && qaPhase === 1) {
    primaryLabel = 'Save & route to Department Comments';
  } else if (status === 'PENDING_QA_REVIEW' && qaPhase === 2) {
    primaryLabel = 'Approve & forward to RA Evaluation';
  }

  return (
    <Paper variant="outlined" sx={{
        p: 2, mb: 2, borderLeft: '4px solid', borderLeftColor: 'primary.main',
        borderRadius: 1.5,
      }}>
      <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>{desc.title}</Typography>
        <Typography variant="caption" color="text.secondary">· {desc.actor}</Typography>
        {status === 'PENDING_QA_REVIEW' && (
          <Chip size="small" color={qaPhase === 2 ? 'success' : 'default'}
                label={`Phase ${qaPhase}`} />
        )}
        {(record?.resendCount > 0) && (
          <Chip size="small" color="warning" label={`Resent ${record.resendCount}×`} />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {effectiveHelper}
      </Typography>

      {/* Initiator's data — read-only context on every non-DRAFT stage */}
      {status !== 'DRAFT' && status !== 'PENDING_HOD' /* HOD also sees it but below */ && (
        <InitiatorContext record={record} lineItems={lineItems} />
      )}
      {status === 'PENDING_HOD' && <InitiatorContext record={record} lineItems={lineItems} />}

      {/* HOD's Initial Assessment — surfaced read-only to downstream stages */}
      {status !== 'PENDING_HOD' && record?.riskAssessment && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4 }}>
            HOD&apos;S INITIAL ASSESSMENT
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.4, whiteSpace: 'pre-wrap' }}>
            {record.riskAssessment}
          </Typography>
        </Alert>
      )}

      {/* QA Pre-Remark — visible to depts during PENDING_DEPT_COMMENT */}
      {(status === 'PENDING_DEPT_COMMENT' || (status === 'PENDING_QA_REVIEW' && qaPhase === 2))
        && record?.preRemark && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4 }}>
            QA PRE-REMARK
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.4, whiteSpace: 'pre-wrap' }}>
            {record.preRemark}
          </Typography>
        </Alert>
      )}

      {/* Activity history timeline for QA Evaluation */}
      {status === 'PENDING_QA_REVIEW' && (
        <ActivityHistory history={record?.statusHistory} resendCount={record?.resendCount || 0} />
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Dept-comment progress + forward gate (PENDING_DEPT_COMMENT only) */}
      {isDeptCommentStage && (
        <Alert severity={blockForward ? 'warning' : 'success'} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2">
              Department comments: <strong>{deptCompleted}</strong>/<strong>{deptTotal || 0}</strong> completed
            </Typography>
            {deptTotal === 0 && <Chip size="small" label="No departments requested yet" />}
            {blockForward && (
              <Typography variant="caption" color="text.secondary">
                · Each requested department&apos;s HOD must fill their comment before this can be forwarded to RA Evaluation.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* Phase-1 hint: invite at least one department */}
      {status === 'PENDING_QA_REVIEW' && qaPhase === 1 && (
        <Alert severity={deptTotal === 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
          {deptTotal === 0
            ? 'No departments invited yet — open the Department-Wise Comments accordion below and invite at least one before saving.'
            : `${deptTotal} department${deptTotal !== 1 ? 's' : ''} invited. Save will route the record to PENDING_DEPT_COMMENT.`}
        </Alert>
      )}

      {/* Editable fields */}
      {effectiveFields.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {effectiveFields.map((f) => {
            if (f === 'preRemark') {
              return (
                <Grid key={f} item xs={12}>
                  <TextField label="Pre-Remark" required multiline rows={3} fullWidth
                             value={form.preRemark ?? ''}
                             onChange={(e) => setForm(prev => ({ ...prev, preRemark: e.target.value }))}
                             placeholder="QA's pre-dept-comment narrative — visible to invited dept HODs."
                             inputProps={{ autoComplete: 'off' }} />
                </Grid>
              );
            }
            if (f === 'qaEvalRemark') {
              return (
                <Grid key={f} item xs={12}>
                  <TextField label="QA Evaluation Remark" required multiline rows={3} fullWidth
                             value={form.qaEvalRemark ?? ''}
                             onChange={(e) => setForm(prev => ({ ...prev, qaEvalRemark: e.target.value }))}
                             placeholder="QA's evaluation of the department feedback + next steps."
                             inputProps={{ autoComplete: 'off' }} />
                </Grid>
              );
            }
            if (f === 'riskAssessmentRequired') {
              return (
                <Grid key={f} item xs={6}>
                  <TextField label="Risk Assessment" select fullWidth
                             value={form.riskAssessmentRequired ? 'Required' : 'Not Required'}
                             onChange={(e) => setForm(prev => ({ ...prev, riskAssessmentRequired: e.target.value === 'Required' }))}>
                    <MenuItem value="Required">Required</MenuItem>
                    <MenuItem value="Not Required">Not Required</MenuItem>
                  </TextField>
                </Grid>
              );
            }
            if (f === 'riskAssessment') {
              return form.riskAssessmentRequired ? (
                <Grid key={f} item xs={12}>
                  <TextField label="Risk Assessment Narrative" required multiline rows={3} fullWidth
                             value={form.riskAssessment ?? ''}
                             onChange={(e) => setForm(prev => ({ ...prev, riskAssessment: e.target.value }))}
                             inputProps={{ autoComplete: 'off' }} />
                </Grid>
              ) : null;
            }
            if (f === 'siteHeadRequired') {
              return (
                <Grid key={f} item xs={6}>
                  <FormControlLabel
                    control={<Switch checked={!!form.siteHeadRequired}
                                     onChange={(e) => setForm(prev => ({ ...prev, siteHeadRequired: e.target.checked }))} />}
                    label="Site Head Required"
                  />
                </Grid>
              );
            }
            if (f === 'customerCommunicationRequired') {
              return (
                <Grid key={f} item xs={6}>
                  <FormControlLabel
                    control={<Switch checked={!!form.customerCommunicationRequired}
                                     onChange={(e) => setForm(prev => ({ ...prev, customerCommunicationRequired: e.target.checked }))} />}
                    label="Customer Communication Required"
                  />
                </Grid>
              );
            }
            return <FieldEditor key={f} name={f} form={form} setForm={setForm} />;
          })}
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
            ? `Cannot forward — ${deptPending} department comment(s) still pending`
            : `POST .../${desc.primary}?comment=…`}>
          <span>
            <Button
              variant="contained"
              startIcon={desc.primary === 'close' ? <SaveIcon /> : <ForwardIcon />}
              color={desc.primary === 'close' ? 'success' : 'primary'}
              onClick={() => submit(desc.primary)}
              disabled={saving || rejecting || resending || !comment.trim() || blockForward}
            >
              {saving ? 'Saving…' : primaryLabel}
            </Button>
          </span>
        </Tooltip>

        {/* HOD-only Resend button — distinct from Reject */}
        {status === 'PENDING_HOD' && (
          <Tooltip title="Send back to Initiator for revision — record returns to DRAFT, not REJECTED">
            <span>
              <Button
                variant="outlined" color="warning"
                startIcon={<ResendIcon />}
                onClick={() => setResendDialog(true)}
                disabled={saving || rejecting || resending}
              >
                {resending ? 'Sending…' : 'Resend to Initiator'}
              </Button>
            </span>
          </Tooltip>
        )}

        {desc.secondary && (
          <Button variant="outlined" onClick={() => submit('transition')}
                  disabled={saving || rejecting || resending || !comment.trim()}>
            {desc.secondary.label}
          </Button>
        )}

        <Tooltip title="POST .../reject?comment=…  (terminal — Initiator must re-raise)">
          <span>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => submit('reject')}
              disabled={saving || rejecting || resending || !comment.trim()}
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Resend confirmation */}
      <Dialog open={resendDialog} onClose={() => setResendDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Resend to Initiator?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will send the record back to the Initiator (status returns to <code>DRAFT</code>)
            so they can edit. <strong>The resend count will be incremented and the Initiator will receive a notification.</strong>
          </Typography>
          <Typography variant="body2">
            This is different from <em>Reject</em> — Reject terminates the record;
            Resend keeps it alive for revision.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResendDialog(false)} disabled={resending}>Cancel</Button>
          <Button variant="contained" color="warning"
                  onClick={async () => { setResendDialog(false); await submit('resend'); }}
                  disabled={resending}>
            {resending ? 'Sending…' : 'Yes, Resend'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ChangeControlStagePanel;
