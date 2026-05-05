import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
} from '@mui/icons-material';
import {
  updateChangeControlApi, approveChangeControlApi, rejectChangeControlApi,
  closeChangeControlApi, transitionChangeControlApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';

/**
 * ChangeControlStagePanel — stage-aware editable form for Change Control.
 *
 * The Change Control workflow has many gates (HOD → QA → Dept Comments →
 * RA → Site Head → Customer → Head QA → Verification → Closed). Each gate
 * needs the actor to fill in different fields *before* moving the record
 * forward. This panel renders only the inputs that are relevant for the
 * current status, then bundles "save fields" and "transition" into one
 * action so the user doesn't have to do it in two steps.
 *
 * The panel is read-only when:
 *   - the record is in DRAFT (use Submit button below for transition)
 *   - the record is in a terminal state (CLOSED / CANCELLED / REJECTED / REOPENED)
 *
 * For Resend / Reject the existing WorkflowActionDialog handles it (we
 * surface the Reject button here as a shortcut).
 *
 * API contract:
 *   - Field updates use PUT /api/v1/qms/change-controls/{id}
 *   - Forward transition uses POST .../approve?comment=... (canonical next
 *     step) or .../close?comment=... when CLOSED is the next step.
 *   - Reject uses POST .../reject?comment=...
 */

// ── Stage descriptors ───────────────────────────────────────────────
// Each entry says what fields the actor edits at that status, which
// transition the primary action triggers, and what to call the button.
const STAGE_DESCRIPTORS = {
  PENDING_HOD: {
    title: 'HOD Review',
    actor: 'Department Head of Department',
    helper: 'Review the proposed change. Capture the risk assessment narrative and link any related CAPA, then approve or send back.',
    fields: ['riskAssessment', 'linkedCapaNumber'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to QA Review',
  },
  PENDING_QA_REVIEW: {
    title: 'QA Evaluation',
    actor: 'QA Reviewer',
    helper:
      'Set Priority + Risk Level, choose the approval routing branches and the regulatory / validation flags, then route the record to the relevant departments via the Department-Wise Comments accordion below.',
    fields: [
      'priority', 'riskLevel',
      'siteHeadRequired', 'customerCommunicationRequired',
      'customerCommentRequired', 'customerRepresentative',
      'regulatorySubmissionRequired', 'regulatorySubmissionReference',
      'validationRequired', 'validationCompletionDate', 'validationDetails',
    ],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Dept Comments',
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each requested department',
    helper:
      'Each requested department\'s HOD fills their comment in the Department-Wise Comments accordion below. When all are complete, the QA Reviewer forwards the record to RA Evaluation.',
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
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_SITE_HEAD: {
    title: 'Site Head Concurrence',
    actor: 'Site Head',
    helper: 'Record the Site Head\'s concurrence remark and forward.',
    // Site Head concurrence narrative is appended to comments via
    // applyRequest(); the field is rendered as "comments" so the workflow
    // history captures it.
    fields: ['comments'],
    primary: 'approve',
    primaryLabel: 'Concurrence & forward to Head QA',
  },
  PENDING_CUSTOMER_COMMENT: {
    title: 'Customer Approval',
    actor: 'Customer Representative',
    helper:
      'Capture the Customer Representative\'s details and their feedback comment, then forward.',
    fields: ['customerRepresentative', 'customerComment'],
    primary: 'approve',
    primaryLabel: 'Forward to Head QA',
  },
  PENDING_HEAD_QA: {
    title: 'Approval by Head QA',
    actor: 'Head of QA',
    helper: 'Record the final approval narrative and decide.',
    fields: ['approvalComments'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Verification',
  },
  PENDING_VERIFICATION: {
    title: 'Verification of Change Implementation',
    actor: 'Initiator → Manager QA → Head QA',
    helper:
      'Initiator fills Action Taken / Effective On for each line item (use the Line Items accordion). Manager QA reviews — Head QA closes the record.',
    fields: [
      'verificationActionTaken',
      'verificationEffectiveOn',
      'verificationDocumentsReissue',
      'verificationOtherComments',
      'verificationRegCommunication',
    ],
    primary: 'close',
    primaryLabel: 'Close Change Control',
  },
};

// ── Field renderer ─────────────────────────────────────────────────
const FieldEditor = ({ name, form, setForm, xs = 12 }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'riskAssessment':
      return (
        <Grid item xs={xs}>
          <TextField label="Risk Assessment" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Capture the risk assessment narrative here…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'linkedCapaNumber':
      return (
        <Grid item xs={6}>
          <TextField label="Linked CAPA #" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="e.g. CAPA-202504-0007 (optional)"
                     helperText="If a CAPA already addresses this change, link it here."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'priority':
      return (
        <Grid item xs={6}>
          <TextField label="Priority" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'riskLevel':
      return (
        <Grid item xs={6}>
          <TextField label="Risk Level" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}>
            {['Low', 'Medium', 'High'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'siteHeadRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Site Head Approval Required"
          />
        </Grid>
      );
    case 'customerCommentRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Customer Comment Branch (legacy)"
          />
        </Grid>
      );
    case 'validationRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Validation Required"
          />
        </Grid>
      );
    case 'validationCompletionDate':
      return form.validationRequired ? (
        <Grid item xs={6}>
          <TextField label="Validation Completion Date" type="date" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'validationDetails':
      return form.validationRequired ? (
        <Grid item xs={12}>
          <TextField label="Validation Details" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'category':
      return (
        <Grid item xs={6}>
          <TextField label="Category (impact)" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}>
            {['', 'Critical', 'Major', 'Minor'].map((c) => (
              <MenuItem key={c || '__'} value={c}>{c || <em>— select —</em>}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'customerCommunicationRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Customer Communication Required"
          />
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
    case 'approvalComments':
      return (
        <Grid item xs={12}>
          <TextField label="Approval Comments" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Final approval narrative recorded on the printed CC form."
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

// ──────────────────────────────────────────────────────────────────
const ChangeControlStagePanel = ({ record, onUpdated }) => {
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]       = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError]     = useState(null);

  // Department-comment progress — only fetched while in PENDING_DEPT_COMMENT.
  // We use it to disable "Forward to RA Evaluation" until every requested
  // dept HOD has filled their comment, mirroring the backend guard.
  const [deptComments, setDeptComments] = useState([]);

  // Reset the form whenever the record changes (or its status flips).
  useEffect(() => {
    if (!record || !desc) { setForm({}); setComment(''); return; }
    const BOOL_FIELDS = new Set([
      'verificationDocumentsReissue', 'customerCommunicationRequired',
      'regulatorySubmissionRequired', 'siteHeadRequired',
      'customerCommentRequired', 'validationRequired',
    ]);
    const fresh = {};
    desc.fields.forEach((f) => {
      fresh[f] = record[f] ?? (BOOL_FIELDS.has(f) ? false : '');
    });
    setForm(fresh);
    setComment('');
    setError(null);
  }, [record?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull dept-comment rows when the record is at the dept-comment gate so we
  // can show progress + gate the forward button. Re-runs whenever the panel
  // reopens or onUpdated() refetches.
  useEffect(() => {
    if (status !== 'PENDING_DEPT_COMMENT' || !record?.id) {
      setDeptComments([]);
      return;
    }
    listDeptCommentsApi('change-control', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);

  if (!desc) return null;  // DRAFT or terminal — handled by main workflow buttons

  // PENDING_DEPT_COMMENT only — block "Forward to RA Evaluation" until every
  // requested dept HOD has filled their comment. The backend enforces the
  // same guard; surfacing it in the UI gives clearer feedback than a 400.
  const deptPending     = deptComments.filter((r) => r.status === 'PENDING').length;
  const deptTotal       = deptComments.length;
  const deptCompleted   = deptTotal - deptPending;
  const isDeptCommentStage = status === 'PENDING_DEPT_COMMENT';
  const blockForward       = isDeptCommentStage && deptPending > 0;

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
      // Step 1 — persist any field updates (skipped if no editable fields).
      if (desc.fields.length > 0) {
        // Pass through only the keys the stage owns — the backend mapper
        // ignores nulls so we're safe sending undefined for the rest.
        const payload = {
          // Backend's PUT requires title + priority since it shares
          // QmsBaseRequest validation. Send them through unchanged.
          title:    record.title,
          priority: record.priority,
          ...form,
        };
        await updateChangeControlApi(record.id, payload);
      }

      // Step 2 — workflow transition.
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

      {/* Dept-comment progress + forward gate (PENDING_DEPT_COMMENT only) */}
      {isDeptCommentStage && (
        <Alert severity={blockForward ? 'warning' : 'success'} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2">
              Department comments: <strong>{deptCompleted}</strong>/<strong>{deptTotal || 0}</strong> completed
            </Typography>
            {deptTotal === 0 && (
              <Chip size="small" label="No departments requested yet" />
            )}
            {blockForward && (
              <Typography variant="caption" color="text.secondary">
                · Each requested department&apos;s HOD must fill their comment before this can be forwarded to RA Evaluation.
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
        label="Comment for audit trail" required multiline rows={2} fullWidth
        value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Why are you forwarding / rejecting at this stage?"
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

        <Tooltip title="POST .../reject?comment=…">
          <span>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => submit('reject')}
              disabled={saving || rejecting || !comment.trim()}
            >
              {rejecting ? 'Rejecting…' : 'Reject / Send Back'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
};

export default ChangeControlStagePanel;
