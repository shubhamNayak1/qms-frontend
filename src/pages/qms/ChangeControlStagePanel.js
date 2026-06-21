import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ESignDialog from '../../components/ESignDialog';
import StageAttachments from './StageAttachments';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
  Undo as ResendIcon,
} from '@mui/icons-material';
import {
  updateChangeControlApi, approveChangeControlApi, rejectChangeControlApi,
  closeChangeControlApi, transitionChangeControlApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi, listLineItemsApi } from '../../api/qmsCommonApi';
import QmsDepartmentAttachmentsSection from './QmsDepartmentAttachmentsSection';
import { useAuth } from '../../store/AuthContext';
// formatDateTime previously used by Activity History (removed in Round-3 R18).

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
    actor: 'Head of Department',
    helper: 'Review every field the Initiator captured below, then write your Initial Assessment. Three outcomes: forward to QA, send back to Initiator for revision, or reject.',
    fields: ['initialAssessment'],
    requiredFields: ['initialAssessment'],
    primary: 'approve',
    // Round-3 R10: HOD button reads "Review & forward to QA" — HOD is
    // performing the review, not approving the change itself.
    primaryLabel: 'Review & forward to QA Evaluation',
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
    // Round-2 H1: CC Type (category) is already set by QA at Phase 1 —
    // RA sees it read-only, doesn't re-enter it.
    // Round-2 H2: Regulatory Assessment Required + Submission Reference
    // are RA's exclusive turf — moved out of QA Phase 2.
    helper: 'Capture the regulatory submission decision and supporting reference.',
    fields: ['regulatorySubmissionRequired', 'regulatorySubmissionReference'],
    requiredFields: [],
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
    // Round-3 R26: the workflow Remark / Justification IS the Approval
    // Comment at this stage — no separate field. The TextField label flips
    // to "Approval Comment" via a per-stage rule in the JSX below.
    // Round-3 R28: Head QA forwards to Department Attachments (where each
    // dept that flagged action_required uploads supporting documents) and
    // from there to Verification.
    helper: 'Record the final approval narrative as the Approval Comment, then approve. Departments that flagged Action Required will upload supporting attachments before Verification.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_ATTACHMENTS: {
    title: 'Department Attachments',
    actor: 'Action-Required Department HODs → Head of QA',
    helper: 'Each department that flagged Action Required during Department-Wise Comments uploads a supporting document with a remark. Head QA approves each row. Once every row is APPROVED the record advances to Verification.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Advance to Verification',
  },
  PENDING_VERIFICATION: {
    title: 'Verification of Change Implementation',
    actor: 'Initiator → Manager QA → Head QA',
    // Round-3 R29: Documents Reissue toggle removed (it confused testers
    // and the implementation team can already capture it in the narrative).
    helper: 'Initiator fills Action Taken / Effective On. Manager QA reviews — Head QA closes the record.',
    fields: [
      'verificationActionTaken', 'verificationEffectiveOn',
      'verificationOtherComments', 'verificationRegCommunication',
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
    <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        CAPTURED BY INITIATOR
      </Typography>
      {/* Round-3 R16 / R19: every section stamps the actor + date. */}
      <SectionStamp actor={record?.raisedByName || record?.createdBy}
                    when={record?.createdAt} />
    </Stack>
    <Grid container spacing={1} sx={{ mt: 0.5 }}>
      {record.recordNumber && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Control Number:</strong> {record.recordNumber}</Typography>
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

// Round-3 R18: ActivityHistory removed — it duplicated the drawer-level
// Status History block. Status History now carries the fromStatus → toStatus
// pair with actor + timestamp, which covers every use case Activity History
// did. The Resend-count chip is surfaced in the drawer header.

// Round-3 R16 / R19: small helper that finds the StatusHistory entry that
// terminated a given stage and returns "by {actor} · on {date}" — used to
// stamp every read-only section with WHO captured it and WHEN.
const findStageActor = (history, terminalTransitions) => {
  if (!Array.isArray(history) || history.length === 0) return null;
  // walk most-recent → first, return the first match. Using fromStatus as
  // the discriminator catches the actual stage that produced the data
  // (e.g. PENDING_HOD → anywhere = HOD's signoff).
  for (const h of [...history].reverse()) {
    if (terminalTransitions.includes(h.fromStatus)) {
      return { actor: h.changedByUsername || h.actor, when: h.changedAt || h.timestamp };
    }
  }
  return null;
};

const SectionStamp = ({ actor, when }) => {
  if (!actor && !when) return null;
  const d = when ? new Date(when) : null;
  const formatted = d && !isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    : null;
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
      by <strong>{actor || '—'}</strong>{formatted ? ` · on ${formatted}` : ''}
    </Typography>
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
      // Round-3 R20: renamed to "Risk Level" UI-side. The underlying column
      // stays as `category` to avoid churning the schema; the UI label is
      // the single source of truth presented to the user.
      return (
        <Grid item xs={6}>
          <TextField label="Risk Level" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     helperText="Critical / Major / Minor — drives the auto-target-date on QA Head approval.">
            {['', 'Critical', 'Major', 'Minor'].map((c) => (
              <MenuItem key={c || '__'} value={c}>{c || <em>— select —</em>}</MenuItem>
            ))}
          </TextField>
          {v && (
            <Box sx={{ mt: 1 }}>
              <Chip size="small"
                    label={`Risk: ${v}`}
                    color={v === 'Critical' ? 'error' : v === 'Major' ? 'warning' : 'info'} />
            </Box>
          )}
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
          {/* Round-3 R29: effective/implemented date must be today or later.
              Picker enforces min via the input attr; server re-validates. */}
          <TextField label="Effective / Implemented On" type="date" required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     placeholder="DD/MM/YYYY"
                     inputProps={{
                       autoComplete: 'off',
                       min: new Date().toISOString().slice(0, 10),
                     }} />
        </Grid>
      );
    case 'verificationDocumentsReissue':
      // Round-3 R29: Documents Reissue toggle removed from the verification
      // form entirely. Field kept on the entity for legacy records.
      return null;
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
  const { user: currentUser } = useAuth();

  const [form, setForm]           = useState({});
  const [comment, setComment]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState(null);
  const [resendDialog, setResendDialog] = useState(false);
  // Dedicated Resend reason — kept separate from the main Remark / Justification
  // so the user can resend without first scrolling up to fill the panel field.
  // (Round-2 C5: the resend silently no-op'd when the panel field was empty.)
  const [resendReason, setResendReason] = useState('');
  // Round-2 E3: e-sign gate before executing a workflow transition.
  // pendingAction holds the action key while the e-sign dialog is open;
  // on success doSubmit() runs the original network calls.
  const [pendingAction, setPendingAction] = useState(null);
  const [eSignOpen, setESignOpen] = useState(false);

  const [deptComments, setDeptComments] = useState([]);
  const [lineItems, setLineItems]       = useState([]);

  // Two-phase QA Evaluation: Phase 2 is detected by ANY completed dept comment.
  const hasCompletedDeptComment = deptComments.some(d => d.status === 'COMPLETED');
  const qaPhase = (status === 'PENDING_QA_REVIEW' && hasCompletedDeptComment) ? 2 : 1;

  // ── Form state setup ────────────────────────────────────────────
  useEffect(() => {
    if (!record) { setForm({}); setComment(''); return; }
    // We carry every conceivable field — render filter happens in JSX
    // based on stage. Round-2 F1: initialAssessment (HOD's) and riskAssessment
    // (QA's) are now stored in separate columns so QA's Phase-2 textarea
    // doesn't pre-populate with the HOD's text.
    const fresh = {
      initialAssessment:            record.initialAssessment ?? '',
      category:                     record.category ?? '',
      preRemark:                    record.preRemark ?? '',
      qaEvalRemark:                 record.comments ?? '',
      // Risk Assessment "Required?" toggle starts based on whether QA has
      // already filled the narrative. Starts as FALSE (i.e. "Not Required")
      // on fresh Phase-2 entry — QA explicitly opts in.
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
  //
  // Round-3 R21 / R22 / R24 / R25:
  //   Phase 1 — Risk Level + Pre-Remark are mandatory. Approval routing
  //              flags are HIDDEN. The workflow Remark / Justification is
  //              MANDATORY only when QA hasn't invited any departments
  //              (i.e. they're forwarding straight without a fan-out).
  //   Phase 2 — after every invited department has responded. The QA
  //              Evaluation Remark is now "Post Remark" (R24) and is
  //              mandatory. Approval routing flags BECOME AVAILABLE so
  //              QA can pick the downstream routing now that they have
  //              dept feedback in hand.
  const qaPhase1Fields = ['category', 'preRemark'];
  const qaPhase1Required = ['category', 'preRemark'];
  const qaPhase2Fields = [
    'qaEvalRemark',
    'riskAssessmentRequired', 'riskAssessment',
    'siteHeadRequired', 'customerCommunicationRequired',
    'customerRepresentative',
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
      effectiveHelper   = deptTotal === 0
        ? 'PHASE 1 — Set the Risk Level and write a Pre-Remark. To send to departments, invite them via the Department-Wise Comments accordion below. Otherwise fill the Remark / Justification to forward directly.'
        : 'PHASE 1 — Risk Level + Pre-Remark captured. Departments are now responding. The Remark / Justification is OPTIONAL while you wait; it becomes mandatory in Phase 2 once they finish.';
    } else {
      effectiveFields   = qaPhase2Fields;
      effectiveRequired = qaPhase2Required;
      effectiveHelper   = 'PHASE 2 — All invited departments have responded. Capture the Post Remark, decide Risk Assessment, and set Approval Routing (Site Head / Customer Communication) before forwarding to RA Evaluation.';
    }
  }

  // ── Submit ────────────────────────────────────────────────────
  //
  // Round-2 E3: Workflow transitions are gated behind a 21 CFR Part 11
  // e-signature. submit(action) validates inputs, then opens the e-sign
  // modal. The actual network calls run inside doSubmit(action) once the
  // server has verified the password.
  const submit = (action) => {
    if (!record) return;
    setError(null);

    // Resend uses its own dedicated reason (gathered in the Resend dialog),
    // so the main panel's "Remark / Justification" can stay empty when the
    // reviewer is sending back without first filling other fields. Other
    // actions still require the main remark for audit-trail purposes.
    const effectiveComment = action === 'resend'
      ? resendReason.trim()
      : comment.trim();

    // Round-3 R21: at QA Phase 1 with depts invited, the workflow Remark
    // is OPTIONAL — QA is still mid-flow. Other transitions stay strict.
    const remarkOptional = action !== 'resend'
                        && status === 'PENDING_QA_REVIEW'
                        && qaPhase === 1
                        && deptTotal > 0;
    if (!effectiveComment && !remarkOptional) {
      setError(action === 'resend'
        ? 'A reason is required for Resend — please enter it in the dialog.'
        : 'A Remark / Justification is required for this action — it is recorded on the audit trail.');
      return;
    }

    // Stash the action and open the e-sign dialog.
    setPendingAction(action);
    setESignOpen(true);
  };

  // doSubmit — the original network-call body. Runs only after e-sign succeeds.
  const doSubmit = async (action) => {
    if (!record) return;
    const effectiveComment = action === 'resend'
      ? resendReason.trim()
      : comment.trim();

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
          // Round-2 F1: HOD writes to initial_assessment (separate column).
          // riskAssessment is reserved for QA's Phase-2 narrative.
          payload.initialAssessment = form.initialAssessment;
        }
        if (status === 'PENDING_QA_REVIEW' && qaPhase === 1) {
          payload.category   = form.category;
          payload.preRemark  = form.preRemark;
          payload.riskLevel  = form.category; // mirror — same values
        }
        if (status === 'PENDING_QA_REVIEW' && qaPhase === 2) {
          // Round-2 H2: regulatorySubmissionRequired / Reference removed —
          // they live on the RA stage now.
          // Round-2 F2: customerRepresentative only persisted when
          // customerCommunicationRequired = TRUE; otherwise NULL.
          payload.comments                     = form.qaEvalRemark;
          payload.riskAssessment               = form.riskAssessmentRequired ? form.riskAssessment : null;
          payload.siteHeadRequired             = !!form.siteHeadRequired;
          payload.customerCommunicationRequired= !!form.customerCommunicationRequired;
          payload.customerRepresentative       = form.customerCommunicationRequired
                                                  ? (form.customerRepresentative || null)
                                                  : null;
        }
        if (status === 'PENDING_RA_REVIEW') {
          // Round-2 H1: category is read-only at RA (set by QA at Phase 1) —
          // we don't send it back. Only the regulatory submission fields are
          // written here.
          payload.regulatorySubmissionRequired = !!form.regulatorySubmissionRequired;
          payload.regulatorySubmissionReference = form.regulatorySubmissionRequired
                                                    ? (form.regulatorySubmissionReference || null)
                                                    : null;
        }
        if (status === 'PENDING_SITE_HEAD' || status === 'PENDING_CUSTOMER_COMMENT'
            || status === 'PENDING_HEAD_QA' || status === 'PENDING_VERIFICATION') {
          // Pass through only the keys the stage owns
          effectiveFields.forEach((f) => { payload[f] = form[f]; });
        }
        // Round-3 R26: at Head QA the workflow remark IS the Approval Comment.
        if (status === 'PENDING_HEAD_QA') {
          payload.approvalComments = effectiveComment;
        }
        await updateChangeControlApi(record.id, payload);
      }

      switch (action) {
        case 'approve':
          await approveChangeControlApi(record.id, effectiveComment);
          break;
        case 'close':
          await closeChangeControlApi(record.id, effectiveComment);
          break;
        case 'reject':
          await rejectChangeControlApi(record.id, effectiveComment);
          break;
        case 'resend':
          // Resend = ANY reviewer state → DRAFT via the generic transition
          // endpoint. Backend WorkflowPosition gates who can do it from each
          // source state. Round-2 widened this from HOD-only to all reviewer
          // stages (D1 / F3 / H3).
          await transitionChangeControlApi(record.id, {
            targetStatus: 'DRAFT',
            comment: effectiveComment,
          });
          setResendReason(''); // clear so a stale value doesn't leak into next round
          break;
        case 'transition':
          await transitionChangeControlApi(record.id, {
            targetStatus: desc.secondary.target,
            comment: effectiveComment,
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

      {/* HOD's Initial Assessment — surfaced read-only to downstream stages.
          Round-3 R19: stamped with actor + date.
          Round-2 F1: reads from the dedicated initial_assessment column. */}
      {status !== 'PENDING_HOD' && record?.initialAssessment && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4 }}>
            HOD&apos;S INITIAL ASSESSMENT
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.4, whiteSpace: 'pre-wrap' }}>
            {record.initialAssessment}
          </Typography>
          {(() => {
            const stamp = findStageActor(record?.statusHistory, ['PENDING_HOD']);
            return stamp ? <SectionStamp {...stamp} /> : null;
          })()}
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
          {(() => {
            const stamp = findStageActor(record?.statusHistory, ['PENDING_QA_REVIEW']);
            return stamp ? <SectionStamp {...stamp} /> : null;
          })()}
        </Alert>
      )}

      {/* QA Decision Summary — visible read-only on every stage downstream
          of QA (RA, Site Head, Customer, Head QA, Verification). Shows the
          Change Control Type + flags the QA Reviewer captured, so the next
          actor doesn't have to scroll back. Round-2 H1: was previously
          re-asked at RA stage which was wrong. */}
      {['PENDING_RA_REVIEW','PENDING_SITE_HEAD','PENDING_CUSTOMER_COMMENT',
        'PENDING_HEAD_QA','PENDING_VERIFICATION','CLOSED'].includes(status)
        && (record?.category || record?.comments) && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4 }}>
            QA EVALUATION SUMMARY
          </Typography>
          <Grid container spacing={1} sx={{ mt: 0.4 }}>
            {record.category && (
              <Grid item xs={6}>
                <Typography variant="body2"><strong>Risk Level:</strong> {record.category}</Typography>
              </Grid>
            )}
            {record.siteHeadRequired != null && (
              <Grid item xs={6}>
                <Typography variant="body2"><strong>Site Head:</strong> {record.siteHeadRequired ? 'Required' : 'Not required'}</Typography>
              </Grid>
            )}
            {record.customerCommunicationRequired != null && (
              <Grid item xs={6}>
                <Typography variant="body2"><strong>Customer Comm.:</strong> {record.customerCommunicationRequired ? 'Required' : 'Not required'}</Typography>
              </Grid>
            )}
            {record.customerCommunicationRequired && record.customerRepresentative && (
              <Grid item xs={6}>
                <Typography variant="body2"><strong>Customer Rep:</strong> {record.customerRepresentative}</Typography>
              </Grid>
            )}
            {record.comments && (
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  <strong>QA Post Remark:</strong> {record.comments}
                </Typography>
              </Grid>
            )}
          </Grid>
          {(() => {
            const stamp = findStageActor(record?.statusHistory,
                                          ['PENDING_QA_REVIEW','PENDING_DEPT_COMMENT']);
            return stamp ? <SectionStamp {...stamp} /> : null;
          })()}
        </Alert>
      )}

      {/* Round-3 R18: Activity History removed — it duplicated the
          drawer-level Status History block. Resend count is surfaced as
          a chip in the drawer header instead. */}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stage attachments moved BELOW Remark/Justification per Round-3 R15. */}

      {/* Round-3 R28: PENDING_ATTACHMENTS — show the dept-attachment fan-out
          where each action-required dept uploads + Head QA approves. */}
      {status === 'PENDING_ATTACHMENTS' && (
        <Box sx={{ mb: 2 }}>
          <QmsDepartmentAttachmentsSection
            commonSlug="change-control"
            recordId={record.id}
            currentUser={currentUser}
          />
        </Box>
      )}

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
                                     onChange={(e) => {
                                       const next = e.target.checked;
                                       // Round-2 F2: turning Customer Communication
                                       // off also clears the Customer Representative
                                       // field so we don't carry a stale value.
                                       setForm(prev => ({
                                         ...prev,
                                         customerCommunicationRequired: next,
                                         ...(next ? {} : { customerRepresentative: '' }),
                                       }));
                                     }} />}
                    label="Customer Communication Required"
                  />
                </Grid>
              );
            }
            // Round-2 F2: Customer Representative is conditional. Hide entirely
            // when Customer Communication is not flagged — the field has no
            // meaning without the comm leg, and showing it always was confusing
            // the testers.
            if (f === 'customerRepresentative' && !form.customerCommunicationRequired) {
              return null;
            }
            return <FieldEditor key={f} name={f} form={form} setForm={setForm} />;
          })}
        </Grid>
      )}

      {(() => {
        // Round-3 R24: at QA Phase 2 the label flips to "Post Remark".
        // Round-3 R26: at Head QA the field IS the Approval Comment.
        // Round-3 R21: at QA Phase 1 with depts invited, the field is
        //              OPTIONAL while we wait for them to respond.
        const isQaPhase1WithDepts = status === 'PENDING_QA_REVIEW'
                                    && qaPhase === 1 && deptTotal > 0;
        const fieldLabel = status === 'PENDING_HEAD_QA' ? 'Approval Comment'
                        : status === 'PENDING_QA_REVIEW' && qaPhase === 2 ? 'Post Remark'
                        : 'Remark / Justification';
        const placeholder = status === 'PENDING_HEAD_QA'
          ? 'Final approval narrative — captured as the record\'s Approval Comment and on the audit trail.'
          : isQaPhase1WithDepts
            ? 'Optional while departments are responding. Will become mandatory in Phase 2.'
            : 'Recorded on the audit trail as the actor\'s remark for this transition.';
        return (
          <TextField
            label={fieldLabel} required={!isQaPhase1WithDepts}
            multiline rows={2} fullWidth
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={placeholder}
            sx={{ mb: 1.5 }}
            inputProps={{ autoComplete: 'off' }}
          />
        );
      })()}

      {/* Round-3 R15: Stage attachments rendered BELOW the Remark /
          Justification field so the actor sees their remark first and
          attaches supporting evidence afterwards. */}
      {!['DRAFT','CLOSED','CANCELLED','REJECTED','REOPENED'].includes(status) && record?.id && (
        <StageAttachments
          moduleKey="changeControl"
          recordId={record.id}
          readOnly={false}
          heading={`${desc.title} — attachments`}
        />
      )}

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

        {/* Resend to Initiator — shown on EVERY reviewer stage (not just HOD).
            Round-2 tester feedback (D1, F3, H3): QA / RA / Site Head / Customer
            / Head-QA reviewers should send back to Initiator for revision
            rather than reject outright. */}
        {['PENDING_HOD','PENDING_QA_REVIEW','PENDING_RA_REVIEW','PENDING_SITE_HEAD',
          'PENDING_CUSTOMER_COMMENT','PENDING_HEAD_QA','PENDING_VERIFICATION'].includes(status) && (
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

        {/* Reject — Round-2 tester feedback (C4, D1, F3, H3): only HOD
            Assessment shows Reject. Every other reviewer stage uses Resend. */}
        {status === 'PENDING_HOD' && (
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
        )}
      </Stack>

      {/* Resend confirmation — has its own Reason field so the reviewer
          doesn't need to first fill the panel-level Remark to use it.
          Round-2 fix for C5: the silent fail when the panel remark was empty. */}
      <Dialog open={resendDialog} onClose={() => setResendDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Resend to Initiator?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            This will send the record back to the Initiator (status returns to <code>DRAFT</code>)
            so they can edit. <strong>The resend count will be incremented and the Initiator will receive a notification.</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This is different from <em>Reject</em> — Reject terminates the record;
            Resend keeps it alive for revision.
          </Typography>
          <TextField
            label="Reason for resend" required multiline rows={3} fullWidth autoFocus
            value={resendReason}
            onChange={(e) => setResendReason(e.target.value)}
            placeholder="Tell the Initiator what to fix. This appears in their inbox notification and is logged on the audit trail."
            error={resendDialog && resendReason.trim().length === 0 && resending === false && Boolean(error)}
            helperText="Required — minimum 5 characters."
            inputProps={{ autoComplete: 'off' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setResendDialog(false); setResendReason(''); }} disabled={resending}>
            Cancel
          </Button>
          <Button variant="contained" color="warning"
                  onClick={async () => {
                    if (resendReason.trim().length < 5) {
                      setError('Please enter at least 5 characters of reason for resend.');
                      return;
                    }
                    setResendDialog(false);
                    await submit('resend');
                  }}
                  disabled={resending || resendReason.trim().length < 5}>
            {resending ? 'Sending…' : 'Yes, Resend'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Round-2 E3 — 21 CFR Part 11 e-signature gate. Opened by submit()
          and closed by doSubmit() once the workflow API resolves. */}
      <ESignDialog
        open={eSignOpen}
        onClose={() => !saving && !rejecting && !resending && setESignOpen(false)}
        onSigned={async () => {
          try {
            await doSubmit(pendingAction);
          } finally {
            setESignOpen(false);
            setPendingAction(null);
          }
        }}
        meaning={pendingAction
          ? `${pendingAction === 'approve' ? 'Approve / Forward'
              : pendingAction === 'reject'  ? 'Reject record'
              : pendingAction === 'resend'  ? 'Resend to Initiator'
              : pendingAction === 'close'   ? 'Close record'
              : 'Workflow transition'} — ${record?.recordNumber || record?.title || ''}`
          : ''}
        recordRef={record?.recordNumber}
        actionLabel={pendingAction === 'reject' ? 'Sign & reject'
                    : pendingAction === 'resend' ? 'Sign & resend'
                    : pendingAction === 'close'  ? 'Sign & close'
                    : 'Sign & forward'}
      />
    </Paper>
  );
};

export default ChangeControlStagePanel;
