import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Grid, TextField, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
} from '@mui/icons-material';
import {
  updateDeviationApi, approveDeviationApi, rejectDeviationApi, submitDeviationApi,
  closeDeviationApi, transitionDeviationApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';
import QmsDepartmentCommentsSection from './QmsDepartmentCommentsSection';
import { useAuth } from '../../store/AuthContext';
import QmsDepartmentAttachmentsSection from './QmsDepartmentAttachmentsSection';
import { StageSection, StickyActionBar, findStageActor as flowFindStageActor, InitiatorSubmissionView } from './LinearFlow';
import { formatDate } from '../../utils/helpers';

/**
 * DeviationStagePanel — stage-aware editable form for Deviation.
 *
 * Walks the Kedar-sir flow chart (May 2026):
 *
 *   DRAFT
 *     → PENDING_HOD          (HOD assessment + optional CAPA cross-link)
 *     → PENDING_QA_REVIEW (1) (QA invites depts)
 *         ↔ PENDING_DEPT_COMMENT
 *     → PENDING_QA_REVIEW (2) (QA sets site_head_required + customer_comment_required)
 *     → PENDING_RA_REVIEW + (optional) PENDING_CUSTOMER_COMMENT
 *     → (optional) PENDING_SITE_HEAD
 *     → PENDING_HEAD_QA       (Head QA approves)
 *     → PENDING_ATTACHMENTS   (each dept uploads; Head QA approves each row)
 *     → PENDING_VERIFICATION  (Investigation Summary)
 *     → CLOSED
 */

const STAGE_DESCRIPTORS = {
  // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6.
  DRAFT: {
    title: 'Initiation',
    actor: 'Initiator',
    helper: 'Review what you captured below. When ready, click Submit for Review to forward the record to a peer reviewer.',
    fields: ['title','priority','deviationType','productBatch','processArea','description'],
    requiredFields: ['title'],
    primary: 'submit',
    primaryLabel: 'Submit for Review',
  },
  // Round-L (2026-06-26): peer-review gate (see CAPA notes).
  PENDING_REVIEW: {
    title: 'Peer Review',
    actor: 'Department Reviewer',
    helper: 'Verify the details captured by the Initiator below. Forward to HOD when correct, or send back to the Initiator for edits.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Submit to HOD',
    secondary: { kind: 'transition', target: 'DRAFT', label: 'Send back to Initiator' },
  },
  PENDING_HOD: {
    title: 'HOD Assessment',
    actor: 'HOD of originating dept',
    helper:
      'Carry out the initial + detailed investigation with root cause and attachments. Decide whether a CAPA is required and link the CAPA #.',
    fields: ['riskAssessment', 'impactAssessment', 'capaRequired', 'linkedCapaNumber'],
    primary: 'approve',
    primaryLabel: 'Review & forward to QA Evaluation',
  },
  PENDING_QA_REVIEW: {
    title: 'Evaluation by QA',
    actor: 'QA Reviewer',
    helper:
      'Two passes use this stage: pass 1 invites the cross-functional departments via the accordion below; pass 2 (after every dept fills) sets Site Head Required + Customer Comment Required and forwards to RA. Your "Approve" button forwards to RA — the secondary button invites depts for the first pass.',
    fields: ['siteHeadRequired', 'customerCommentRequired'],
    primary: 'approve',
    primaryLabel: 'Forward to RA Evaluation',
    secondary: { kind: 'transition', target: 'PENDING_DEPT_COMMENT', label: 'Invite Departments for Comment' },
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each invited department',
    helper:
      'Each invited dept HOD fills their feedback in the accordion below. Once every row is COMPLETED, the QA Reviewer clicks "Back to QA Evaluation" — the forward button stays disabled until then.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Back to QA Evaluation',
    secondary: null,
  },
  PENDING_RA_REVIEW: {
    title: 'Evaluation by RA',
    actor: 'RA member',
    helper: 'Capture the regulatory commentary on this Deviation, then forward.',
    fields: ['regulatorySubmissionRequired', 'regulatorySubmissionReference', 'comments'],
    primary: 'approve',
    // Forward target depends on flags — we let the workflow engine pick the
    // canonical next step (either Site Head if required, else Head QA).
    primaryLabel: 'Approve & forward',
    secondary: { kind: 'transition', target: 'PENDING_CUSTOMER_COMMENT', label: 'Route Customer Comment' },
  },
  PENDING_CUSTOMER_COMMENT: {
    title: 'Customer Comment',
    actor: 'Customer Representative',
    helper: 'Capture the customer\'s response, then forward to Site Head (if required) or Head QA.',
    fields: ['customerRepresentative', 'customerComment'],
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_SITE_HEAD: {
    title: 'Site Head Concurrence',
    actor: 'Site Head',
    helper: 'Record the Site Head concurrence, then forward to Head QA.',
    fields: ['comments'],
    primary: 'approve',
    primaryLabel: 'Concurrence & forward to Head QA',
  },
  PENDING_HEAD_QA: {
    title: 'Approval by Head QA',
    actor: 'Head of QA',
    // Round-4 G5 (=Round-3 R26): the workflow Remark IS the Approval Comment.
    helper:
      'Final approval. Record the Approval Comment, then approve and forward.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Department Attachments',
    secondary: { kind: 'transition', target: 'PENDING_QA_REVIEW', label: 'Send back to QA' },
  },
  PENDING_ATTACHMENTS: {
    title: 'Department Attachments',
    actor: 'Responsible departments + Head QA',
    helper:
      'Each responsible dept uploads their supporting attachment. Head QA approves every row. Once all rows are APPROVED the record can move to Investigation Summary — the backend blocks it otherwise.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Forward to Investigation Summary',
  },
  PENDING_VERIFICATION: {
    title: 'Investigation Summary',
    actor: 'Originating dept HOD',
    helper:
      'Compile the closure cover-sheet narrative — the final Investigation Summary printed alongside this Deviation.',
    fields: ['investigationSummary'],
    primary: 'close',
    primaryLabel: 'Close Deviation',
    secondary: { kind: 'transition', target: 'PENDING_ATTACHMENTS', label: 'Send back to Attachments' },
  },
};

// ── Field renderer ─────────────────────────────────────────────────
const FieldEditor = ({ name, form, setForm }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'riskAssessment':
      return (
        <Grid item xs={12}>
          <TextField label="Risk Assessment" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Capture the risk assessment narrative…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'impactAssessment':
      return (
        <Grid item xs={12}>
          <TextField label="Impact Assessment" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Affected batches, regulatory exposure, customer impact…"
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
    case 'linkedCapaNumber':
      return form.capaRequired ? (
        <Grid item xs={6}>
          <TextField label="Linked CAPA #" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="e.g. CAPA-202504-0007"
                     helperText="Generated when CAPA Required is on. Will be cross-linked on the CAPA record."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'siteHeadRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Site Head Required"
          />
        </Grid>
      );
    case 'customerCommentRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Customer Comment Required"
          />
        </Grid>
      );
    case 'regulatorySubmissionRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Regulatory Submission Required"
          />
        </Grid>
      );
    case 'regulatorySubmissionReference':
      return form.regulatorySubmissionRequired ? (
        <Grid item xs={6}>
          <TextField label="Submission Reference" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Dossier number, country, etc."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
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
          <TextField label="Customer Response / Feedback" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="What the customer said about the deviation…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'comments':
      return (
        <Grid item xs={12}>
          <TextField label="Comments / Concurrence" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Recorded on the audit trail."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'approvalComments':
      return (
        <Grid item xs={12}>
          <TextField label="Approval Narrative" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Final approval narrative recorded on the printed cover sheet."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'investigationSummary':
      return (
        <Grid item xs={12}>
          <TextField
            label="Investigation Summary" required multiline rows={5} fullWidth
            value={v} onChange={(e) => set(e.target.value)}
            placeholder="Closure cover-sheet narrative — root cause, actions taken, evidence references."
            inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

// ──────────────────────────────────────────────────────────────────
const DeviationStagePanel = ({ record, onUpdated }) => {
  const { user: currentUser } = useAuth();
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]       = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [rejecting, setRejecting] = useState(false);
  // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6.
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError]     = useState(null);

  const [deptComments, setDeptComments] = useState([]);

  useEffect(() => {
    if (!record || !desc) { setForm({}); setComment(''); return; }
    const BOOL_FIELDS = new Set([
      'capaRequired', 'siteHeadRequired', 'customerCommentRequired',
      'regulatorySubmissionRequired',
    ]);
    const fresh = {};
    desc.fields.forEach((f) => {
      fresh[f] = record[f] ?? (BOOL_FIELDS.has(f) ? false : '');
    });
    setForm(fresh);
    setComment('');
    setError(null);
  }, [record?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Round-M (2026-06-27) tester CC-Point-1 · follow-up:
  // Live-refresh + broaden coverage to PENDING_QA_REVIEW so QA can
  // invite depts from Phase 1 with the same fresh state as CC.
  const refreshDeptComments = useCallback(() => {
    if (!record?.id) { setDeptComments([]); return; }
    if (status !== 'PENDING_QA_REVIEW' && status !== 'PENDING_DEPT_COMMENT') {
      setDeptComments([]); return;
    }
    listDeptCommentsApi('deviation', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);
  useEffect(() => { refreshDeptComments(); }, [refreshDeptComments]);

  if (!desc) return null;

  const deptPending     = deptComments.filter((r) => r.status === 'PENDING').length;
  const deptTotal       = deptComments.length;
  const deptCompleted   = deptTotal - deptPending;
  const isDeptCommentStage = status === 'PENDING_DEPT_COMMENT';
  const blockForward       = isDeptCommentStage && deptPending > 0;

  const ageDays = record?.createdAt
    ? Math.floor((Date.now() - new Date(record.createdAt).getTime()) / (24 * 3600 * 1000))
    : null;
  const isLate = ageDays != null && ageDays > 30;
  const extApproved = (record?.targetDateExtensionStatus || '').toUpperCase() === 'APPROVED';
  const showSlaWarning = isLate && status !== 'CLOSED' && status !== 'CANCELLED' && !extApproved;

  const submit = async (action) => {
    if (!record) return;
    setError(null);

    // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: Save Draft
    // skips the remark requirement; Submit-for-Review still needs one.
    if (action !== 'saveDraft' && !comment.trim()) {
      setError('A comment is required for this action — it is recorded on the audit trail.');
      return;
    }

    const flag = action === 'reject'    ? setRejecting
              : action === 'saveDraft'  ? setSavingDraft
                                        : setSaving;
    flag(true);
    try {
      if (status === 'DRAFT' && (action === 'submit' || action === 'saveDraft')) {
        await updateDeviationApi(record.id, {
          title:         form.title         ?? record.title,
          priority:      form.priority      ?? record.priority,
          deviationType: form.deviationType ?? '',
          productBatch:  form.productBatch  ?? '',
          processArea:   form.processArea   ?? '',
          description:   form.description   ?? '',
        });
      }

      if (status !== 'DRAFT' && (desc.fields.length > 0 || status === 'PENDING_HEAD_QA')) {
        const payload = {
          title:    record.title,
          priority: record.priority,
          ...form,
        };
        // Round-4 G5: at Head QA the workflow Remark IS the Approval Comment.
        if (status === 'PENDING_HEAD_QA' && action === 'approve') {
          payload.approvalComments = comment.trim();
        }
        await updateDeviationApi(record.id, payload);
      }

      switch (action) {
        // Round-M — DRAFT actions.
        case 'submit':
          await submitDeviationApi(record.id, comment.trim());
          break;
        case 'saveDraft':
          break;
        case 'approve':
          await approveDeviationApi(record.id, comment.trim());
          break;
        case 'close':
          await closeDeviationApi(record.id, comment.trim());
          break;
        case 'reject':
          await rejectDeviationApi(record.id, comment.trim());
          break;
        case 'resend':
          await transitionDeviationApi(record.id, {
            targetStatus: 'DRAFT',
            comment: comment.trim(),
          });
          break;
        case 'transition':
          await transitionDeviationApi(record.id, {
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

  // ── Round-4 L5 linear-flow ──────────────────────────────────────
  const DEV_STAGES = [
    { key: 'DRAFT',                  title: 'Initiation' },
    // Round-L: peer-review gate.
    { key: 'PENDING_REVIEW',         title: 'Peer Review' },
    { key: 'PENDING_HOD',            title: 'HOD Assessment' },
    { key: 'PENDING_QA_REVIEW',      title: 'QA Evaluation' },
    { key: 'PENDING_DEPT_COMMENT',   title: 'Department-Wise Comments',
      optional: true, skipReason: deptComments.length === 0 ? 'No departments invited' : null },
    { key: 'PENDING_RA_REVIEW',      title: 'RA Evaluation' },
    { key: 'PENDING_CUSTOMER_COMMENT', title: 'Customer Comment',
      optional: true, skipReason: record?.customerCommunicationRequired === false ? 'Customer Comm. = No' : null },
    { key: 'PENDING_SITE_HEAD',      title: 'Site Head',
      optional: true, skipReason: record?.siteHeadRequired === false ? 'Site Head Req. = No' : null },
    { key: 'PENDING_HEAD_QA',        title: 'Approval by Head QA' },
    { key: 'PENDING_ATTACHMENTS',    title: 'Department Attachments',
      optional: true, skipReason: !deptComments.some((c) => c.actionRequired) ? 'No dept flagged Action Required' : null },
    { key: 'PENDING_VERIFICATION',   title: 'Verification' },
    { key: 'CLOSED',                 title: 'Closed' },
  ];
  const devCurrentIdx = DEV_STAGES.findIndex((s) => s.key === status);
  const devStageState = (stage, idx) => {
    if (stage.optional && stage.skipReason && idx < devCurrentIdx) return 'skipped';
    if (idx === devCurrentIdx) return stage.key === 'CLOSED' ? 'terminal' : 'current';
    return idx < devCurrentIdx ? 'past' : 'future';
  };
  const devStageActor = (stage) => {
    if (stage.key === 'DRAFT') return { actor: record?.raisedByName || record?.createdBy, when: record?.createdAt };
    if (stage.key === 'CLOSED') return { actor: record?.approvedByName, when: record?.closedDate || record?.approvedAt };
    return flowFindStageActor(record?.statusHistory, [stage.key]);
  };
  const devRoBody = (key) => {
    switch (key) {
      case 'DRAFT': return (
        <Grid container spacing={1}>
          {record.deviationType && <Grid item xs={6}><Typography variant="body2"><strong>Type:</strong> {record.deviationType}</Typography></Grid>}
          {record.productBatch && <Grid item xs={6}><Typography variant="body2"><strong>Batch:</strong> {record.productBatch}</Typography></Grid>}
          {record.processArea && <Grid item xs={6}><Typography variant="body2"><strong>Process Area:</strong> {record.processArea}</Typography></Grid>}
          {record.impactAssessment && <Grid item xs={12}><Typography variant="body2"><strong>Impact:</strong> {record.impactAssessment}</Typography></Grid>}
        </Grid>
      );
      case 'PENDING_HOD': return record?.initialAssessment
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.initialAssessment}</Typography>
        : <Typography variant="caption" color="text.secondary">No HOD assessment.</Typography>;
      case 'PENDING_QA_REVIEW': return record?.comments
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.comments}</Typography>
        : <Typography variant="caption" color="text.secondary">No QA narrative.</Typography>;
      case 'PENDING_RA_REVIEW': return (
        <Typography variant="body2">
          Regulatory Submission Required: <strong>{record.regulatorySubmissionRequired ? 'Yes' : 'No'}</strong>
          {record.regulatorySubmissionReference && ` · ${record.regulatorySubmissionReference}`}
        </Typography>
      );
      case 'PENDING_HEAD_QA': return record?.approvalComments
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}><strong>Approval Comment:</strong> {record.approvalComments}</Typography>
        : <Typography variant="caption" color="text.secondary">No approval comment.</Typography>;
      case 'PENDING_VERIFICATION': return record?.verificationActionTaken
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}><strong>Action Taken:</strong> {record.verificationActionTaken}</Typography>
        : <Typography variant="caption" color="text.secondary">No verification narrative.</Typography>;
      case 'CLOSED': return (
        <Typography variant="body2" color="success.main">
          Record closed{record?.closedDate ? ` on ${formatDate(record.closedDate)}` : ''}.
        </Typography>
      );
      default: return null;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Workflow Progress</Typography>

      {DEV_STAGES.map((stage, idx) => {
        const state = devStageState(stage, idx);
        if (state === 'future') return null;
        const stamp = devStageActor(stage) || {};
        return (
          <StageSection key={stage.key}
            title={stage.title} state={state}
            actor={stamp.actor} when={stamp.when}
            skippedReason={state === 'skipped' ? stage.skipReason : null}
          >
            {state === 'current' ? (
              <Typography variant="body2" color="text.secondary">{desc.helper}</Typography>
            ) : state === 'skipped' ? null : (
              <>
                {devRoBody(stage.key)}
                {/* Round-L (2026-06-27): surface the transition Remark /
                    Justification captured when this past stage was
                    completed. Mirrors CC's H5 pattern. */}
                {stamp.comment && (
                  <Box sx={{ mt: 1.2, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4, color: 'text.secondary' }}>
                      REMARK / JUSTIFICATION
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.3 }}>
                      {stamp.comment}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </StageSection>
        );
      })}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {showSlaWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This Deviation is <strong>{ageDays} days old</strong> — past the 30-day SLA.
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
                · Each invited dept HOD must fill their row before this can be sent back to QA.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* PENDING_ATTACHMENTS — dept upload + Head QA approval inline. */}
      {status === 'PENDING_ATTACHMENTS' && (
        <Box sx={{ mb: 2 }}>
          <QmsDepartmentAttachmentsSection
            commonSlug="deviation"
            recordId={record.id}
            currentUser={currentUser}
          />
        </Box>
      )}

      {/* Round-M (2026-06-27) follow-up: inline dept-comments accordion
          at QA + Dept-Comment stages with live-refresh. */}
      {(status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT')
        && record?.id && (
        <Box sx={{ mb: 2 }}>
          <QmsDepartmentCommentsSection
            commonSlug="deviation"
            recordId={record.id}
            currentUser={currentUser}
            recordTargetDate={record?.targetCompletionDate}
            onChange={refreshDeptComments}
          />
        </Box>
      )}

      {/* Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: Initiator-
          editable fields at DRAFT. Past Initiation section keeps the
          read-only view via the past-stage renderer above. */}
      {status === 'DRAFT' && (
        <Box sx={{ mb: 2 }}>
          <InitiatorSubmissionView
            record={record}
            commonSlug="deviation"
            editable
            form={form}
            setForm={setForm}
            isResend={(record?.resendCount ?? 0) > 0}
            editableFields={[
              { key: 'title',         label: 'Title',           type: 'text',     xs: 12, required: true },
              { key: 'priority',      label: 'Priority',        type: 'select',   xs: 6,
                options: ['LOW','MEDIUM','HIGH','CRITICAL'] },
              { key: 'deviationType', label: 'Deviation Type',  type: 'text',     xs: 6 },
              { key: 'productBatch',  label: 'Product / Batch', type: 'text',     xs: 6 },
              { key: 'processArea',   label: 'Process Area',    type: 'text',     xs: 6 },
              { key: 'description',   label: 'Description',     type: 'textarea', xs: 12 },
            ]}
          />
        </Box>
      )}

      {/* Round-M (2026-06-27) — DRAFT edits rendered by
          InitiatorSubmissionView above, not here. */}
      {status !== 'DRAFT' && desc.fields.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {desc.fields.map((f) => (
            <FieldEditor key={f} name={f} form={form} setForm={setForm} />
          ))}
        </Grid>
      )}

      <TextField
        // Round-4 G5 (=Round-3 R26): at Head QA the field IS the Approval Comment.
        label={status === 'PENDING_HEAD_QA' ? 'Approval Comment' : 'Remark / Justification'}
        required multiline rows={2} fullWidth
        value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={status === 'PENDING_HEAD_QA'
          ? 'Final approval narrative — captured as the record\'s Approval Comment and on the audit trail.'
          : 'Recorded on the audit trail as the actor\'s remark for this transition.'}
        sx={{ mb: 1.5 }}
        inputProps={{ autoComplete: 'off' }}
      />

      <StickyActionBar
        helperText={blockForward
          ? `${deptPending} department comment(s) still pending — forward is blocked.`
          : null}
      >
        {/* Round-M (2026-06-27) — Save Draft at DRAFT. */}
        {status === 'DRAFT' && (
          <Tooltip title="Save edits without forwarding — record stays at Initiation">
            <span>
              <Button
                variant="outlined" color="primary" startIcon={<SaveIcon />}
                onClick={() => submit('saveDraft')}
                disabled={saving || savingDraft || rejecting}
              >
                {savingDraft ? 'Saving…' : 'Save Draft'}
              </Button>
            </span>
          </Tooltip>
        )}

        <Tooltip title={blockForward
            ? `Cannot advance — ${deptPending} department comment(s) still pending`
            : `POST .../${desc.primary}?comment=…`}>
          <span>
            <Button
              variant="contained"
              startIcon={desc.primary === 'close' ? <SaveIcon /> : <ForwardIcon />}
              color={desc.primary === 'close' ? 'success' : 'primary'}
              onClick={() => submit(desc.primary)}
              disabled={saving || savingDraft || rejecting || !comment.trim() || blockForward}
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
              variant="outlined" color="error"
              startIcon={<RejectIcon />}
              onClick={() => submit('reject')}
              disabled={saving || rejecting || !comment.trim()}
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </span>
        </Tooltip>
      </StickyActionBar>
    </Box>
  );
};

export default DeviationStagePanel;
