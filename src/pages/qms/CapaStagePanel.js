import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
} from '@mui/icons-material';
import {
  updateCapaApi, approveCapaApi, rejectCapaApi,
  closeCapaApi, transitionCapaApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';
import { useAuth } from '../../store/AuthContext';
import QmsCapaAssessmentsSection from './QmsCapaAssessmentsSection';
import QmsDepartmentAttachmentsSection from './QmsDepartmentAttachmentsSection';
import { StageSection, StickyActionBar, findStageActor as flowFindStageActor } from './LinearFlow';
import { formatDate } from '../../utils/helpers';

/**
 * CapaStagePanel — stage-aware editable form for CAPA.
 *
 * Pre-closure path:
 *   DRAFT
 *    → PENDING_HOD              (Proposed CAPA — HOD's Initial Remedial + Preventive)
 *    → PENDING_QA_REVIEW (1)    (QA invites depts)
 *      ↔ PENDING_DEPT_COMMENT
 *    → PENDING_QA_REVIEW (2)    (QA sets siteHeadRequired)
 *    → [PENDING_SITE_HEAD]
 *    → PENDING_HEAD_QA          (approves / rejects)
 *    → PENDING_ATTACHMENTS      (each dept uploads + Head QA approves each)
 *    → PENDING_VERIFICATION     (HOD: Action Taken + Effective Document)
 *    → PENDING_VERIFICATION_REVIEW (QA Reviewer accepts the verification)
 *    → CLOSED                   (Head QA: sets assessment frequency + count)
 *
 * Post-closure effectiveness lifecycle (CAPA-only) — handled by
 * QmsCapaAssessmentsSection accordion below the panel:
 *   CLOSED → EFFECTIVENESS_PENDING ↔ EFFECTIVENESS_REVIEW → EFFECTIVENESS_VERIFIED
 */

const STAGE_DESCRIPTORS = {
  // Round-L (2026-06-26): peer-review gate between DRAFT and PENDING_HOD.
  // A different user in the originating dept (is_dept_reviewer) verifies
  // the captured fields and forwards to HOD.
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
    title: 'Proposed CAPA by HOD',
    actor: 'HOD of originating dept',
    helper:
      'Capture the initial Remedial Action and Preventive Action with attachments. The CAPA is then sent to QA for evaluation.',
    fields: ['correctiveAction', 'preventiveAction', 'rootCause'],
    primary: 'approve',
    primaryLabel: 'Review & forward to QA Evaluation',
  },
  PENDING_QA_REVIEW: {
    title: 'Evaluation by QA',
    actor: 'QA Reviewer',
    helper:
      'Two passes use this stage: pass 1 invites the cross-functional departments via the accordion below; pass 2 (after every dept fills) sets Site Head Required and forwards to Head QA.',
    fields: ['siteHeadRequired'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Head QA',
    secondary: { kind: 'transition', target: 'PENDING_DEPT_COMMENT', label: 'Invite Departments for Comment' },
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each invited department',
    helper:
      'Each invited dept HOD fills their feedback in the accordion below. Once every row is COMPLETED, QA clicks "Back to QA Evaluation".',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Back to QA Evaluation',
    secondary: null,
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
    // Round-4 G5 (=Round-3 R26): the workflow Remark / Justification IS
    // the Approval Comment at this stage — no separate field.
    helper:
      'Final approval of the proposed CAPA. Record the Approval Comment, then approve and forward.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Department Attachments',
    secondary: { kind: 'transition', target: 'PENDING_QA_REVIEW', label: 'Send back to QA' },
  },
  PENDING_ATTACHMENTS: {
    title: 'Department Attachments',
    actor: 'Responsible departments + Head QA',
    helper:
      'Each responsible dept uploads their supporting attachment. Head QA approves every row. Once all rows are APPROVED the record can move to Verification — the backend blocks it otherwise.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Forward to Verification/Add',
  },
  PENDING_VERIFICATION: {
    title: 'Verification / Add',
    actor: 'Originating dept HOD',
    helper:
      'Capture the Action Taken and the Effective Document reference for the closure cover sheet.',
    // Round-4 G5 (=Round-3 R29): Documents Reissue toggle dropped.
    fields: ['verificationActionTaken', 'verificationEffectiveOn',
             'verificationOtherComments'],
    primary: 'approve',
    primaryLabel: 'Forward to Verification Review',
  },
  PENDING_VERIFICATION_REVIEW: {
    title: 'Verification / Review',
    actor: 'QA Reviewer',
    helper:
      'Review the dept HOD\'s verification narrative + attachment. Accept to forward to Head QA closure, or reject to send back for re-verification.',
    fields: ['verificationReviewComment'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Closure',
    secondary: { kind: 'transition', target: 'PENDING_VERIFICATION', label: 'Send back for re-verification' },
  },
};

const FREQ_OPTS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];

const FieldEditor = ({ name, form, setForm }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'rootCause':
      return (
        <Grid item xs={12}>
          <TextField label="Root Cause Analysis" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Why this happened — root cause analysis."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'correctiveAction':
      return (
        <Grid item xs={12}>
          <TextField label="Initial Remedial Action" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="The corrective action being proposed by the HOD."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'preventiveAction':
      return (
        <Grid item xs={12}>
          <TextField label="Preventive Action" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="What will be done to prevent recurrence."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'siteHeadRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Site Head Required"
          />
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
    case 'verificationActionTaken':
      return (
        <Grid item xs={12}>
          <TextField label="Action Taken / Documents Closed" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationEffectiveOn':
      return (
        <Grid item xs={6}>
          <TextField label="Effective / Implemented On" type="date" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     helperText="DD/MM/YYYY"
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
    case 'verificationOtherComments':
      return (
        <Grid item xs={12}>
          <TextField label="Other Comments" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationReviewComment':
      return (
        <Grid item xs={12}>
          <TextField
            label="QA Review of Verification" required multiline rows={3} fullWidth
            value={v} onChange={(e) => set(e.target.value)}
            placeholder="Was the verification adequate? Any gaps to address before closure?"
            inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

const CapaStagePanel = ({ record, onUpdated }) => {
  const { user: currentUser } = useAuth();
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]       = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError]     = useState(null);

  // Closure dialog state — Head QA picks frequency + count when closing.
  const [freq, setFreq]       = useState('QUARTERLY');
  const [count, setCount]     = useState(4);

  const [deptComments, setDeptComments] = useState([]);

  useEffect(() => {
    if (!record || !desc) { setForm({}); setComment(''); return; }
    const BOOL_FIELDS = new Set(['siteHeadRequired', 'verificationDocumentsReissue']);
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
    listDeptCommentsApi('capa', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);

  const isPostClosure = ['CLOSED', 'EFFECTIVENESS_PENDING',
                         'EFFECTIVENESS_REVIEW', 'EFFECTIVENESS_VERIFIED']
                         .includes(status);

  // Post-closure: render only the assessments accordion (no stage panel).
  if (isPostClosure) {
    return (
      <Paper variant="outlined" sx={{
          p: 2, mb: 2, borderLeft: '4px solid',
          borderLeftColor: status === 'EFFECTIVENESS_VERIFIED' ? 'success.main' : 'info.main',
          borderRadius: 1.5, bgcolor: status === 'EFFECTIVENESS_VERIFIED' ? 'success.50' : 'background.paper',
        }}>
        <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {status === 'CLOSED' ? 'Closed — Effectiveness Phase' :
             status === 'EFFECTIVENESS_VERIFIED' ? 'Effectiveness Verified' :
             'Effectiveness Assessment'}
          </Typography>
          {record.assessmentFrequency && (
            <Chip size="small" label={record.assessmentFrequency} />
          )}
          {record.assessmentCount > 0 && (
            <Chip size="small" label={`${record.assessmentCount} cycle(s)`} />
          )}
          {record.assessmentSummaryStatus && (
            <Chip size="small"
                  color={record.assessmentSummaryStatus === 'COMPLETE' ? 'success' :
                         record.assessmentSummaryStatus === 'IN_PROGRESS' ? 'warning' : 'default'}
                  label={record.assessmentSummaryStatus} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {status === 'EFFECTIVENESS_VERIFIED'
            ? 'Every scheduled effectiveness cycle was accepted. The CAPA is verified effective.'
            : 'The CAPA is closed. The responsible department now runs through each scheduled effectiveness cycle below; QA reviews each one.'}
        </Typography>
        <QmsCapaAssessmentsSection capaId={record.id} onUpdated={onUpdated} />
      </Paper>
    );
  }

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
  const showSlaWarning = isLate && !isPostClosure && !extApproved;

  // Special: PENDING_VERIFICATION_REVIEW → CLOSED is the Head QA's closure
  // moment where they ALSO pick the assessment frequency + count.
  const isClosingMoment = status === 'PENDING_VERIFICATION_REVIEW';

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
      // Step 1 — persist field updates if any. For the closing moment we
      // also stamp assessment_frequency + assessment_count so the engine
      // seeds the assessment cycles when close fires.
      if (desc.fields.length > 0 || isClosingMoment || status === 'PENDING_HEAD_QA') {
        const payload = {
          title:    record.title,
          priority: record.priority,
          ...form,
        };
        if (isClosingMoment && action === 'approve') {
          payload.assessmentFrequency = freq;
          payload.assessmentCount = Number(count) || 0;
        }
        // Round-4 G5: at Head QA the workflow Remark IS the Approval Comment.
        if (status === 'PENDING_HEAD_QA' && action === 'approve') {
          payload.approvalComments = comment.trim();
        }
        await updateCapaApi(record.id, payload);
      }

      switch (action) {
        case 'approve':
          // Closing moment: PENDING_VERIFICATION_REVIEW → CLOSED uses the
          // close endpoint so the engine seeds the assessment lifecycle.
          if (isClosingMoment) {
            await closeCapaApi(record.id, comment.trim());
          } else {
            await approveCapaApi(record.id, comment.trim());
          }
          break;
        case 'close':
          await closeCapaApi(record.id, comment.trim());
          break;
        case 'reject':
          await rejectCapaApi(record.id, comment.trim());
          break;
        case 'resend':
          await transitionCapaApi(record.id, {
            targetStatus: 'DRAFT',
            comment: comment.trim(),
          });
          break;
        case 'transition':
          await transitionCapaApi(record.id, {
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

  // ── Round-4 L6 linear-flow ──────────────────────────────────────
  const CAPA_STAGES = [
    { key: 'DRAFT',                       title: 'Initiation' },
    // Round-L: peer-review gate between Initiation and HOD.
    { key: 'PENDING_REVIEW',              title: 'Peer Review' },
    { key: 'PENDING_HOD',                 title: 'HOD Assessment' },
    { key: 'PENDING_QA_REVIEW',           title: 'QA Evaluation' },
    { key: 'PENDING_DEPT_COMMENT',        title: 'Department-Wise Comments',
      optional: true, skipReason: deptComments.length === 0 ? 'No departments invited' : null },
    { key: 'PENDING_SITE_HEAD',           title: 'Site Head',
      optional: true, skipReason: record?.siteHeadRequired === false ? 'Site Head Req. = No' : null },
    { key: 'PENDING_HEAD_QA',             title: 'Approval by Head QA' },
    { key: 'PENDING_ATTACHMENTS',         title: 'Department Attachments',
      optional: true, skipReason: !deptComments.some((c) => c.actionRequired) ? 'No dept flagged Action Required' : null },
    { key: 'PENDING_VERIFICATION',        title: 'Verification (Add)' },
    { key: 'PENDING_VERIFICATION_REVIEW', title: 'Verification Review' },
    { key: 'CLOSED',                      title: 'Closed' },
  ];
  const capaCurrentIdx = CAPA_STAGES.findIndex((s) => s.key === status);
  const capaStageState = (stage, idx) => {
    if (stage.optional && stage.skipReason && idx < capaCurrentIdx) return 'skipped';
    if (idx === capaCurrentIdx) return stage.key === 'CLOSED' ? 'terminal' : 'current';
    return idx < capaCurrentIdx ? 'past' : 'future';
  };
  const capaStageActor = (stage) => {
    if (stage.key === 'DRAFT') return { actor: record?.raisedByName || record?.createdBy, when: record?.createdAt };
    if (stage.key === 'CLOSED') return { actor: record?.approvedByName, when: record?.closedDate || record?.approvedAt };
    return flowFindStageActor(record?.statusHistory, [stage.key]);
  };
  const capaRoBody = (key) => {
    switch (key) {
      case 'DRAFT': return (
        <Grid container spacing={1}>
          {record.capaType && <Grid item xs={6}><Typography variant="body2"><strong>CAPA Type:</strong> {record.capaType}</Typography></Grid>}
          {record.source && <Grid item xs={6}><Typography variant="body2"><strong>Source:</strong> {record.source}</Typography></Grid>}
          {record.parentRecordNumber && <Grid item xs={12}><Typography variant="body2"><strong>Parent:</strong> {record.parentRecordType?.replace('_', ' ')} {record.parentRecordNumber}</Typography></Grid>}
          {record.rootCause && <Grid item xs={12}><Typography variant="body2"><strong>Root Cause:</strong> {record.rootCause}</Typography></Grid>}
        </Grid>
      );
      case 'PENDING_HOD': return record?.initialAssessment
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.initialAssessment}</Typography>
        : <Typography variant="caption" color="text.secondary">No HOD assessment.</Typography>;
      case 'PENDING_QA_REVIEW': return record?.comments
        ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.comments}</Typography>
        : <Typography variant="caption" color="text.secondary">No QA narrative.</Typography>;
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
      <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Workflow Progress</Typography>
        {record?.parentRecordType && record?.parentRecordNumber && (
          <Chip size="small" color="secondary"
                label={`From ${record.parentRecordType.replace('_', ' ')} ${record.parentRecordNumber}`} />
        )}
      </Stack>

      {CAPA_STAGES.map((stage, idx) => {
        const state = capaStageState(stage, idx);
        if (state === 'future') return null;
        const stamp = capaStageActor(stage) || {};
        return (
          <StageSection key={stage.key}
            title={stage.title} state={state}
            actor={stamp.actor} when={stamp.when}
            skippedReason={state === 'skipped' ? stage.skipReason : null}
          >
            {state === 'current' ? (
              <Typography variant="body2" color="text.secondary">{desc.helper}</Typography>
            ) : state === 'skipped' ? null : capaRoBody(stage.key)}
          </StageSection>
        );
      })}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {showSlaWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This CAPA is <strong>{ageDays} days old</strong> — past the 30-day SLA.
          Closure is blocked until a target-date extension is approved by Head QA.
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
                · Each invited dept HOD must fill their row first.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* PENDING_ATTACHMENTS stage — render the dept-attachment accordion
          inline so QA can invite, dept can upload, and Head QA can decide
          all in one place. */}
      {status === 'PENDING_ATTACHMENTS' && (
        <Box sx={{ mb: 2 }}>
          <QmsDepartmentAttachmentsSection
            commonSlug="capa"
            recordId={record.id}
            currentUser={currentUser}
          />
        </Box>
      )}

      {desc.fields.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {desc.fields.map((f) => (
            <FieldEditor key={f} name={f} form={form} setForm={setForm} />
          ))}
        </Grid>
      )}

      {/* Closure moment — Head QA picks the effectiveness assessment schedule. */}
      {isClosingMoment && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Alert severity="info">
              Approving this verification closes the CAPA. Pick the
              effectiveness-assessment schedule — the system will seed
              that many cycles starting from the closure date.
            </Alert>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Assessment Frequency" select fullWidth value={freq}
                       onChange={(e) => setFreq(e.target.value)}>
              {FREQ_OPTS.map((c) => (
                <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Assessment Count" type="number" fullWidth value={count}
                       onChange={(e) => setCount(e.target.value)}
                       inputProps={{ min: 0, max: 24, autoComplete: 'off' }}
                       helperText="0 = no effectiveness check; record stays at CLOSED" />
          </Grid>
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
        <Tooltip title={blockForward
            ? `Cannot advance — ${deptPending} department comment(s) still pending`
            : `POST .../${desc.primary}?comment=…`}>
          <span>
            <Button
              variant="contained"
              startIcon={isClosingMoment ? <SaveIcon /> : <ForwardIcon />}
              color={isClosingMoment ? 'success' : 'primary'}
              onClick={() => submit('approve')}
              disabled={saving || rejecting || !comment.trim() || blockForward}
            >
              {saving ? 'Saving…' : (isClosingMoment ? 'Approve & Close CAPA' : desc.primaryLabel)}
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

export default CapaStagePanel;
