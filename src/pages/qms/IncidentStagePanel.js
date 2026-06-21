import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
  CallSplit as SpawnIcon,
} from '@mui/icons-material';
import {
  updateIncidentApi, approveIncidentApi, rejectIncidentApi,
  closeIncidentApi, transitionIncidentApi,
  spawnDeviationFromIncidentApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';
import { useAuth } from '../../store/AuthContext';
import QmsDepartmentAttachmentsSection from './QmsDepartmentAttachmentsSection';

/**
 * IncidentStagePanel — stage-aware editable form for Incident.
 *
 * Walks the Kedar-sir flow chart. Four end-to-end paths are encoded:
 *
 *   1. Lab + Retesting Required
 *      DRAFT → PENDING_HOD → PENDING_QA_REVIEW → [Site Head?] → Head QA
 *            → Attachments → Verification → Closed
 *   2. Lab + No Retesting
 *      Same as 1 but the QA stage captures "Abnormality in Proposed RA".
 *   3. General + No Deviation
 *      DRAFT → PENDING_HOD → PENDING_QA_REVIEW ↔ PENDING_DEPT_COMMENT
 *            → [Site Head?] → Head QA → Attachments → Verification → Closed
 *   4. General + Deviation Required
 *      DRAFT → PENDING_HOD → PENDING_QA_REVIEW → DEVIATION_SPAWNED (terminal)
 *      A fresh Deviation is spawned with parent_incident_id = this Incident.
 *
 * The panel renders the same status sequence for all paths but adapts the
 * visible fields and secondary buttons based on the record's branching
 * flags (incidentSubType, retestingRequired, deviationRequired,
 * siteHeadRequired).
 */

const STAGE_DESCRIPTORS = {
  PENDING_HOD: {
    title: 'HOD Assessment',
    actor: 'HOD of originating dept',
    helper:
      'Carry out the initial + detailed investigation with root cause and attachments. Pick the branching flags: Retesting Required (Lab) or Deviation Required (General). Optionally link a CAPA.',
    // Fields shown depend on sub-type — handled by the renderer.
    fields: [
      'incidentSubType', 'severity',
      'retestingRequired', 'deviationRequired',
      'investigationDetails',
      'riskAssessment',
      'capaRequired', 'linkedCapaNumber',
    ],
    primary: 'approve',
    primaryLabel: 'Review & forward to QA Evaluation',
  },
  PENDING_QA_REVIEW: {
    title: 'Assessment by QA',
    actor: 'QA Reviewer',
    helper:
      'Evaluate the Incident. On the General path you can invite cross-functional departments for comment. On the Lab + No-Retesting path, capture the "Abnormality in Proposed RA" narrative. Set Site Head Required if the change is high-impact. If a Deviation is required, click "Spawn Deviation" — this Incident terminates and the Deviation continues.',
    fields: ['siteHeadRequired', 'abnormalityRemedialAction'],
    primary: 'approve',
    primaryLabel: 'Approve & forward to Head QA',
    secondary: { kind: 'transition', target: 'PENDING_DEPT_COMMENT', label: 'Invite Departments for Comment' },
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each invited department',
    helper:
      'Each invited dept HOD fills their feedback in the accordion below. Once every row is COMPLETED, the QA Reviewer clicks "Back to QA Evaluation".',
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
    helper:
      'Final approval. Decide whether to allow the activity to continue or require it to stop. After approval, the responsible departments have 30 days to upload their attachments.',
    fields: ['approvalComments'],
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
    primaryLabel: 'Forward to Verification',
  },
  PENDING_VERIFICATION: {
    title: 'Verification',
    actor: 'Originating dept HOD',
    helper: 'Capture the verification narrative — what was confirmed and how.',
    fields: ['verificationNarrative'],
    primary: 'close',
    primaryLabel: 'Close Incident',
    secondary: { kind: 'transition', target: 'PENDING_ATTACHMENTS', label: 'Send back to Attachments' },
  },
};

const FieldEditor = ({ name, form, setForm, record }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';
  const isLab = (form.incidentSubType || record?.incidentSubType) === 'LABORATORY';
  const isGeneral = (form.incidentSubType || record?.incidentSubType) === 'GENERAL';

  switch (name) {
    case 'incidentSubType':
      return (
        <Grid item xs={6}>
          <TextField label="Sub-Type" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     helperText="Drives the workflow path; immutable once HOD forwards.">
            {['LABORATORY', 'GENERAL'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'severity':
      return (
        <Grid item xs={6}>
          <TextField label="Severity" select fullWidth value={v}
                     onChange={(e) => set(e.target.value)}>
            {['Minor', 'Major', 'Critical'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Grid>
      );
    case 'retestingRequired':
      return isLab ? (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Retesting Required (Lab branch fork)"
          />
        </Grid>
      ) : null;
    case 'deviationRequired':
      return isGeneral ? (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Deviation Required (General branch — spawns a Deviation)"
          />
        </Grid>
      ) : null;
    case 'investigationDetails':
      return (
        <Grid item xs={12}>
          <TextField label="Investigation Details" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Initial + detailed investigation notes…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'riskAssessment':
      return (
        <Grid item xs={12}>
          <TextField label="Risk Assessment" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Capture the risk assessment narrative…"
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
                     helperText="CAPA cross-link generated at HOD Assessment."
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
    case 'abnormalityRemedialAction':
      // Only relevant on the Lab + No-Retest path. Other paths skip it.
      const subType = form.incidentSubType || record?.incidentSubType;
      const showAbnormality =
            subType === 'LABORATORY' && record?.retestingRequired === false;
      return showAbnormality ? (
        <Grid item xs={12}>
          <TextField label="Abnormality in Proposed Remedial Action"
                     multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="How will the lab handle the abnormality without retesting?"
                     helperText="Captured on the Lab + No-Retest path only."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
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
                     placeholder="Allow continue or stop activity? Final approval narrative."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationNarrative':
      return (
        <Grid item xs={12}>
          <TextField
            label="Verification Narrative" required multiline rows={4} fullWidth
            value={v} onChange={(e) => set(e.target.value)}
            placeholder="What was verified, how, with which evidence references."
            inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

const IncidentStagePanel = ({ record, onUpdated }) => {
  const { user: currentUser } = useAuth();
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];

  const [form, setForm]       = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [error, setError]     = useState(null);

  const [deptComments, setDeptComments] = useState([]);

  useEffect(() => {
    if (!record || !desc) { setForm({}); setComment(''); return; }
    const BOOL_FIELDS = new Set([
      'capaRequired', 'siteHeadRequired',
      'retestingRequired', 'deviationRequired',
    ]);
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
    listDeptCommentsApi('incident', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);

  // Terminal DEVIATION_SPAWNED — render a banner instead of an active panel.
  if (status === 'DEVIATION_SPAWNED') {
    return (
      <Paper variant="outlined" sx={{
          p: 2, mb: 2, borderLeft: '4px solid', borderLeftColor: 'success.main',
          borderRadius: 1.5, bgcolor: 'success.50',
        }}>
        <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={700}>Deviation Spawned</Typography>
          <Chip size="small" color="success" label="Terminal — Incident handed off" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This Incident terminated when QA confirmed it required a Deviation.
          The full lifecycle continues on the spawned Deviation:{' '}
          <strong>{record.spawnedDeviationNumber || `id ${record.spawnedDeviationId}`}</strong>.
        </Typography>
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
  const showSlaWarning = isLate && status !== 'CLOSED' && status !== 'CANCELLED' && !extApproved;

  // Three special secondary actions on PENDING_QA_REVIEW that depend on
  // the record's flags rather than the status alone.
  const showSpawnDeviation =
        status === 'PENDING_QA_REVIEW'
     && (record?.incidentSubType === 'GENERAL')
     && (record?.deviationRequired === true);

  const showInviteDepts =
        status === 'PENDING_QA_REVIEW'
     && (record?.incidentSubType === 'GENERAL')
     && (record?.deviationRequired !== true);

  const showForwardSiteHead =
        status === 'PENDING_QA_REVIEW'
     && record?.siteHeadRequired === true;

  const submit = async (action) => {
    if (!record) return;
    setError(null);

    if (!comment.trim()) {
      setError('A comment is required for this action — it is recorded on the audit trail.');
      return;
    }

    const flag = action === 'reject' ? setRejecting
                : action === 'spawn'  ? setSpawning
                                       : setSaving;
    flag(true);
    try {
      if (desc.fields.length > 0 && action !== 'spawn') {
        const payload = {
          title:    record.title,
          priority: record.priority,
          ...form,
        };
        await updateIncidentApi(record.id, payload);
      }

      switch (action) {
        case 'approve':
          await approveIncidentApi(record.id, comment.trim());
          break;
        case 'close':
          await closeIncidentApi(record.id, comment.trim());
          break;
        case 'reject':
          await rejectIncidentApi(record.id, comment.trim());
          break;
        case 'resend':
          await transitionIncidentApi(record.id, {
            targetStatus: 'DRAFT',
            comment: comment.trim(),
          });
          break;
        case 'spawn':
          await spawnDeviationFromIncidentApi(record.id, comment.trim());
          break;
        case 'transitionDeptComment':
          await transitionIncidentApi(record.id, {
            targetStatus: 'PENDING_DEPT_COMMENT',
            comment: comment.trim(),
          });
          break;
        case 'transitionSiteHead':
          await transitionIncidentApi(record.id, {
            targetStatus: 'PENDING_SITE_HEAD',
            comment: comment.trim(),
          });
          break;
        case 'transition':
          await transitionIncidentApi(record.id, {
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
        {record?.incidentSubType && (
          <Chip size="small" label={record.incidentSubType}
                color={record.incidentSubType === 'LABORATORY' ? 'info' : 'default'} />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {desc.helper}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {showSlaWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This Incident is <strong>{ageDays} days old</strong> — past the 30-day SLA.
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
                · Each invited dept HOD must fill their row first.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* PENDING_ATTACHMENTS — dept upload + Head QA approval inline. */}
      {status === 'PENDING_ATTACHMENTS' && (
        <Box sx={{ mb: 2 }}>
          <QmsDepartmentAttachmentsSection
            commonSlug="incident"
            recordId={record.id}
            currentUser={currentUser}
          />
        </Box>
      )}

      {desc.fields.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {desc.fields.map((f) => (
            <FieldEditor key={f} name={f} form={form} setForm={setForm} record={record} />
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
              disabled={saving || rejecting || spawning || !comment.trim() || blockForward}
            >
              {saving ? 'Saving…' : desc.primaryLabel}
            </Button>
          </span>
        </Tooltip>

        {/* PENDING_QA_REVIEW context-sensitive buttons */}
        {showSpawnDeviation && (
          <Tooltip title="Creates a Deviation linked to this Incident; this Incident terminates at DEVIATION_SPAWNED.">
            <span>
              <Button variant="outlined" color="warning" startIcon={<SpawnIcon />}
                      onClick={() => submit('spawn')}
                      disabled={saving || rejecting || spawning || !comment.trim()}>
                {spawning ? 'Spawning…' : 'Spawn Deviation'}
              </Button>
            </span>
          </Tooltip>
        )}

        {showInviteDepts && (
          <Button variant="outlined" onClick={() => submit('transitionDeptComment')}
                  disabled={saving || rejecting || spawning || !comment.trim()}>
            Invite Departments for Comment
          </Button>
        )}

        {showForwardSiteHead && (
          <Button variant="outlined" onClick={() => submit('transitionSiteHead')}
                  disabled={saving || rejecting || spawning || !comment.trim()}>
            Forward to Site Head
          </Button>
        )}

        {desc.secondary && status !== 'PENDING_QA_REVIEW' && (
          <Button variant="outlined" onClick={() => submit('transition')}
                  disabled={saving || rejecting || spawning || !comment.trim()}>
            {desc.secondary.label}
          </Button>
        )}

        {status === 'PENDING_HOD' && (
          <Tooltip title="Send back to Initiator — record returns to DRAFT (not REJECTED)">
            <span>
              <Button variant="outlined" color="warning"
                      onClick={() => submit('resend')}
                      disabled={saving || rejecting || spawning || !comment.trim()}>
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
              disabled={saving || rejecting || spawning || !comment.trim()}
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
};

export default IncidentStagePanel;
