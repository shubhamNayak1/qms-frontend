import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  // Round-5 J1: switched from a side Drawer to a centred Dialog so the
  // record opens like the Create-Draft dialog. Component name kept as
  // RecordDetailDrawer to avoid touching every call site.
  Dialog,
  Box, Typography, Chip, Divider, IconButton, Tooltip,
  CircularProgress, Alert, Button, Stack, Paper, Grid,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Warning as WarnIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  getCapaByIdApi, submitCapaApi, approveCapaApi, rejectCapaApi,
  closeCapaApi, cancelCapaApi, reopenCapaApi, transitionCapaApi,
  getDeviationByIdApi, submitDeviationApi, approveDeviationApi, rejectDeviationApi,
  closeDeviationApi, cancelDeviationApi, reopenDeviationApi, transitionDeviationApi,
  getIncidentByIdApi, submitIncidentApi, approveIncidentApi, rejectIncidentApi,
  closeIncidentApi, cancelIncidentApi, reopenIncidentApi, transitionIncidentApi,
  getComplaintByIdApi, submitComplaintApi, approveComplaintApi, rejectComplaintApi,
  closeComplaintApi, cancelComplaintApi, reopenComplaintApi, transitionComplaintApi,
  getChangeControlByIdApi, submitChangeControlApi, approveChangeControlApi, rejectChangeControlApi,
  closeChangeControlApi, cancelChangeControlApi, reopenChangeControlApi, transitionChangeControlApi,
} from '../../api/qmsApi';
import { listRecordAttachmentsApi } from '../../api/qmsCommonApi';
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS,
  BRANCH_TRANSITIONS, getPrimaryForward, ACTION_LABELS,
  MODULE_META,
} from './qmsConstants';
import WorkflowActionDialog from './WorkflowActionDialog';
import WorkflowStageStepper from './WorkflowStageStepper';
import ChangeControlStagePanel from './ChangeControlStagePanel';
import MarketComplaintStagePanel from './MarketComplaintStagePanel';
import DeviationStagePanel from './DeviationStagePanel';
import IncidentStagePanel from './IncidentStagePanel';
import CapaStagePanel from './CapaStagePanel';
import QmsLineItemsSection from './QmsLineItemsSection';
import StageAttachments from './StageAttachments';
import QmsDepartmentCommentsSection from './QmsDepartmentCommentsSection';
import TargetDateExtensionPanel from './TargetDateExtensionPanel';
import { useAuth } from '../../store/AuthContext';
import { formatDate, formatDateTime } from '../../utils/helpers';

// ── API map per module ────────────────────────────────────────────────────────
const MODULE_APIS = {
  capa:           { getById: getCapaByIdApi,           submit: submitCapaApi,           approve: approveCapaApi,           reject: rejectCapaApi,           close: closeCapaApi,           cancel: cancelCapaApi,           reopen: reopenCapaApi,           transition: transitionCapaApi           },
  deviation:      { getById: getDeviationByIdApi,      submit: submitDeviationApi,      approve: approveDeviationApi,      reject: rejectDeviationApi,      close: closeDeviationApi,      cancel: cancelDeviationApi,      reopen: reopenDeviationApi,      transition: transitionDeviationApi      },
  incident:       { getById: getIncidentByIdApi,       submit: submitIncidentApi,       approve: approveIncidentApi,       reject: rejectIncidentApi,       close: closeIncidentApi,       cancel: cancelIncidentApi,       reopen: reopenIncidentApi,       transition: transitionIncidentApi       },
  marketComplaint:{ getById: getComplaintByIdApi,      submit: submitComplaintApi,      approve: approveComplaintApi,      reject: rejectComplaintApi,      close: closeComplaintApi,      cancel: cancelComplaintApi,      reopen: reopenComplaintApi,      transition: transitionComplaintApi      },
  changeControl:  { getById: getChangeControlByIdApi,  submit: submitChangeControlApi,  approve: approveChangeControlApi,  reject: rejectChangeControlApi,  close: closeChangeControlApi,  cancel: cancelChangeControlApi,  reopen: reopenChangeControlApi,  transition: transitionChangeControlApi  },
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const StatusChip = ({ status }) => (
  <Chip
    label={STATUS_LABELS[status] || status?.replace(/_/g, ' ')}
    size="small"
    color={STATUS_COLORS[status] || 'default'}
  />
);

// Round-5 H2: PriorityChip retired from the drawer header. Replaced with
// a Risk Level chip that only renders after QA has set category.
// eslint-disable-next-line no-unused-vars
const _PriorityChip_legacy = ({ priority }) => (
  <Chip label={priority} size="small" color={PRIORITY_COLORS[priority] || 'default'} variant="outlined" />
);

const Field = ({ label, value, children }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.4} display="block">
      {label}
    </Typography>
    {children || (
      <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
        {value || '—'}
      </Typography>
    )}
  </Box>
);

// ── Module-specific extra fields ──────────────────────────────────────────────
// Round-2 tester feedback (B1, C3): some fields are populated only at later
// stages (Risk Level, Implementation Date, Target Completion, Site-Head-Required,
// Customer-Comment-Required, etc.). At DRAFT / PENDING_HOD we don't show their
// empty slots — only sections genuinely populated by the actor get rendered.
const isDraft = (s) => s === 'DRAFT';
// Round-L (2026-06-27): PENDING_REVIEW added — the peer-review gate
// sits before HOD, well before QA invites departments. Hide every
// "pre-QA" UI block (Department-Wise Comments, target-date extension,
// downstream risk / customer / site-head chips) at this stage too.
const isPreQA = (s) => s === 'DRAFT' || s === 'PENDING_REVIEW' || s === 'PENDING_HOD';

const ModuleExtraFields = ({ moduleKey, record }) => {
  if (!record) return null;
  const status = record.status;
  switch (moduleKey) {
    case 'capa':
      return (
        <Grid container spacing={1}>
          <Grid item xs={6}><Field label="CAPA Type" value={record.capaType} /></Grid>
          <Grid item xs={6}><Field label="Source" value={record.source} /></Grid>
          <Grid item xs={12}><Field label="Root Cause" value={record.rootCause} /></Grid>
          <Grid item xs={12}><Field label="Corrective Action" value={record.correctiveAction} /></Grid>
          <Grid item xs={12}><Field label="Preventive Action" value={record.preventiveAction} /></Grid>
          <Grid item xs={6}><Field label="Effectiveness Check Date" value={formatDate(record.effectivenessCheckDate)} /></Grid>
          <Grid item xs={6}><Field label="Linked Deviation" value={record.linkedDeviationNumber} /></Grid>
        </Grid>
      );
    case 'deviation':
      return (
        <Grid container spacing={1}>
          <Grid item xs={6}><Field label="Deviation Type" value={record.deviationType} /></Grid>
          <Grid item xs={6}><Field label="Product / Batch" value={record.productBatch} /></Grid>
          <Grid item xs={6}><Field label="Process Area" value={record.processArea} /></Grid>
          <Grid item xs={6}><Field label="CAPA Required" value={record.capaRequired ? 'Yes' : 'No'} /></Grid>
          {record.capaReference && <Grid item xs={6}><Field label="CAPA Reference" value={record.capaReference} /></Grid>}
          <Grid item xs={12}><Field label="Impact Assessment" value={record.impactAssessment} /></Grid>
        </Grid>
      );
    case 'incident':
      return (
        <Grid container spacing={1}>
          <Grid item xs={6}><Field label="Incident Type" value={record.incidentType} /></Grid>
          <Grid item xs={6}><Field label="Sub-Type" value={record.incidentSubType} /></Grid>
          <Grid item xs={6}><Field label="Severity" value={record.severity} /></Grid>
          <Grid item xs={6}><Field label="Location" value={record.location} /></Grid>
          <Grid item xs={6}><Field label="Occurrence Date" value={formatDate(record.occurrenceDate)} /></Grid>
          <Grid item xs={6}><Field label="Injury Involved" value={record.injuryInvolved ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={6}><Field label="Retesting Required" value={record.retestingRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={6}><Field label="Deviation Required" value={record.deviationRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={12}><Field label="Immediate Action" value={record.immediateAction} /></Grid>
        </Grid>
      );
    case 'changeControl':
      // Organised by section so it mirrors the printable Change Control Form
      // (Initiation → Risk & Routing → Regulatory & Validation → Implementation).
      // Common fields like riskAssessment / customerComment are rendered by
      // the shared "Risk & Customer" block below the module section, so we
      // don't duplicate them here.
      return (
        <Box>
          {/* Initiation of Change — always shown.
              Round-2 B1 + C3: Risk Level + Implementation/Target dates aren't
              captured by the Initiator, so suppress them until QA writes them
              (status >= PENDING_QA_REVIEW). */}
          <Typography variant="caption" fontWeight={700} color="primary.main"
                      textTransform="uppercase" letterSpacing={0.4} display="block" sx={{ mb: 0.5 }}>
            Initiation of Change
          </Typography>
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            <Grid item xs={6}><Field label="Change Type" value={record.changeType} /></Grid>
            {!isPreQA(status) && record.riskLevel && (
              <Grid item xs={6}><Field label="Risk Level" value={record.riskLevel} /></Grid>
            )}
            {!isPreQA(status) && record.implementationDate && (
              <Grid item xs={6}><Field label="Implementation Date" value={formatDate(record.implementationDate)} /></Grid>
            )}
            {!isPreQA(status) && record.targetCompletionDate && (
              <Grid item xs={6}><Field label="Target Completion" value={formatDate(record.targetCompletionDate)} /></Grid>
            )}
            <Grid item xs={12}><Field label="Reason for Change" value={record.changeReason} /></Grid>
          </Grid>

          {/* Approval routing — Round-4 fix: only render when QA has
              actually decided (at least one flag explicitly non-null).
              Showing "No" for fields the QA hasn't touched yet was
              misleading. */}
          {!isPreQA(status) && (record.siteHeadRequired != null || record.customerCommunicationRequired != null) && (
            <>
              <Typography variant="caption" fontWeight={700} color="primary.main"
                          textTransform="uppercase" letterSpacing={0.4} display="block" sx={{ mb: 0.5 }}>
                Approval Routing
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                {record.siteHeadRequired != null && (
                  <Grid item xs={6}><Field label="Site Head Required" value={record.siteHeadRequired ? 'Yes' : 'No'} /></Grid>
                )}
                {record.customerCommunicationRequired != null && (
                  <Grid item xs={6}><Field label="Customer Comm. Required" value={record.customerCommunicationRequired ? 'Yes' : 'No'} /></Grid>
                )}
              </Grid>
            </>
          )}

          {/* Regulatory + Validation */}
          {(record.regulatorySubmissionRequired || record.regulatorySubmissionReference
            || record.validationRequired || record.validationDetails || record.validationCompletionDate) && (
            <>
              <Typography variant="caption" fontWeight={700} color="primary.main"
                          textTransform="uppercase" letterSpacing={0.4} display="block" sx={{ mb: 0.5 }}>
                Regulatory &amp; Validation
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <Field label="Regulatory Submission Required"
                         value={record.regulatorySubmissionRequired ? 'Yes' : 'No'} />
                </Grid>
                {record.regulatorySubmissionReference && (
                  <Grid item xs={6}>
                    <Field label="Submission Reference" value={record.regulatorySubmissionReference} />
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Field label="Validation Required" value={record.validationRequired ? 'Yes' : 'No'} />
                </Grid>
                {record.validationCompletionDate && (
                  <Grid item xs={6}>
                    <Field label="Validation Completion" value={formatDate(record.validationCompletionDate)} />
                  </Grid>
                )}
                {record.validationDetails && (
                  <Grid item xs={12}><Field label="Validation Details" value={record.validationDetails} /></Grid>
                )}
              </Grid>
            </>
          )}

          {/* Implementation */}
          {(record.implementationPlan || record.rollbackPlan) && (
            <>
              <Typography variant="caption" fontWeight={700} color="primary.main"
                          textTransform="uppercase" letterSpacing={0.4} display="block" sx={{ mb: 0.5 }}>
                Implementation Plan
              </Typography>
              <Grid container spacing={1}>
                {record.implementationPlan && (
                  <Grid item xs={12}><Field label="Implementation Plan" value={record.implementationPlan} /></Grid>
                )}
                {record.rollbackPlan && (
                  <Grid item xs={12}><Field label="Rollback Plan" value={record.rollbackPlan} /></Grid>
                )}
              </Grid>
            </>
          )}
        </Box>
      );
    case 'marketComplaint':
      return (
        <Grid container spacing={1}>
          <Grid item xs={6}><Field label="Customer Name" value={record.customerName} /></Grid>
          <Grid item xs={6}><Field label="Country" value={record.customerCountry} /></Grid>
          <Grid item xs={6}><Field label="Product" value={record.productName} /></Grid>
          <Grid item xs={6}><Field label="Batch Number" value={record.batchNumber} /></Grid>
          <Grid item xs={6}><Field label="Category" value={record.complaintCategory} /></Grid>
          <Grid item xs={6}><Field label="Source" value={record.complaintSource} /></Grid>
          <Grid item xs={6}><Field label="Received Date" value={formatDate(record.receivedDate)} /></Grid>
          <Grid item xs={6}><Field label="Reportable to Authority" value={record.reportableToAuthority ? 'Yes' : 'No'} /></Grid>
        </Grid>
      );
    default: return null;
  }
};

// ── Status History Timeline (custom — no @mui/lab needed) ────────────────────
// Round-5 J2: no longer rendered. Kept as legacy reference until we're
// sure the per-StageSection display covers every audit-trail use case.
// eslint-disable-next-line no-unused-vars
const StatusHistoryTimeline = ({ history }) => {
  if (!history?.length) return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No history yet.</Typography>
  );
  // Round-2 C6: sort by event time ASC so the timeline reads in the order
  // events actually happened (HOD → QA → Dept Comments → …).
  const sorted = [...history].sort((a, b) => {
    const ta = a.changedAt ? new Date(a.changedAt).getTime() : 0;
    const tb = b.changedAt ? new Date(b.changedAt).getTime() : 0;
    return ta - tb;
  });
  return (
    <Box>
      {sorted.map((h, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          {/* dot + connector */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${STATUS_COLORS[h.toStatus] || 'grey'}.main`, flexShrink: 0 }} />
            {i < sorted.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
          </Box>
          {/* content — Round-3 R17: render "fromStatus → toStatus" so the
              row reads as the action that was taken, not as the current state.
              Resend bounces (any reviewer → DRAFT) get a small RESEND chip. */}
          <Box sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              {h.fromStatus && (
                <>
                  <Chip label={STATUS_LABELS[h.fromStatus] || h.fromStatus} size="small"
                        variant="outlined" color={STATUS_COLORS[h.fromStatus] || 'default'} />
                  <Typography variant="caption" sx={{ mx: 0.2 }}>→</Typography>
                </>
              )}
              <Chip label={STATUS_LABELS[h.toStatus] || h.toStatus} size="small" color={STATUS_COLORS[h.toStatus] || 'default'} />
              {h.fromStatus && h.fromStatus !== 'DRAFT' && h.toStatus === 'DRAFT' && (
                <Chip label="RESEND" size="small" color="warning" />
              )}
              <Typography variant="caption" color="text.secondary">
                by <strong>{h.changedByUsername}</strong> · {formatDateTime(h.changedAt)}
              </Typography>
            </Box>
            {h.comment && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3, fontStyle: 'italic' }}>
                "{h.comment}"
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ── Workflow Buttons ──────────────────────────────────────────────────────────
const WorkflowButtons = ({ record, moduleKey, onAction }) => {
  if (!record) return null;
  const { status, allowedTransitions = [] } = record;
  const primaryForward = getPrimaryForward(allowedTransitions);

  return (
    <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
      {/* Submit — from DRAFT. Label changes to "Resend the Record" if HOD has
          previously sent it back (resendCount > 0). Per tester Round-2 B3. */}
      {status === 'DRAFT' && (
        <Button variant="contained" size="small" color="primary"
          onClick={() => onAction('submit', record.resendCount > 0 ? 'Resend the Record' : 'Submit for Review')}>
          {record.resendCount > 0 ? 'Resend the Record' : 'Submit for Review'}
        </Button>
      )}

      {/* Approve / Forward — canonical next step.
          Round-3 R9: hidden at DRAFT (only Submit-for-Review should show there).
          Round-3 R10: at PENDING_HOD the label reads "Review" since the HOD
          is performing the review (they're not approving the change itself). */}
      {status !== 'DRAFT' && primaryForward.length > 0 && (
        <Button variant="contained" size="small" color="success"
          onClick={() => onAction('approve',
              status === 'PENDING_HOD' ? 'Review' : 'Approve / Forward')}>
          {status === 'PENDING_HOD' ? 'Review' : 'Approve / Forward'}
        </Button>
      )}

      {/* Close — when CLOSED is an allowed transition */}
      {allowedTransitions.includes('CLOSED') && (
        <Button variant="contained" size="small" color="success"
          onClick={() => onAction('close', 'Close Record')}>
          Close Record
        </Button>
      )}

      {/* Optional branch buttons */}
      {[...BRANCH_TRANSITIONS].filter((t) => allowedTransitions.includes(t)).map((t) => (
        <Button key={t} variant="outlined" size="small" color="primary"
          onClick={() => onAction('transition', ACTION_LABELS[t], t)}>
          {ACTION_LABELS[t]}
        </Button>
      ))}

      {/* Reject — Round-2 tester feedback: Reject is only acceptable at HOD
          Assessment stage. QA / RA / Site Head / Customer / Head-QA all use
          Resend (send back to Initiator) instead. */}
      {allowedTransitions.includes('REJECTED') && status === 'PENDING_HOD' && (
        <Button variant="outlined" size="small" color="error"
          onClick={() => onAction('reject', 'Reject / Send Back')}>
          Reject
        </Button>
      )}

      {/* Cancel — Round-2 tester feedback: Cancel is not a valid workflow
          action; an Initiator cancelling mid-flight muddies the audit story.
          Hidden universally — use Reject (HOD) or Resend instead. */}

      {/* Reopen — from CLOSED */}
      {status === 'CLOSED' && (
        <Button variant="outlined" size="small" color="warning"
          onClick={() => onAction('reopen', 'Reopen Record')}>
          Reopen
        </Button>
      )}
    </Stack>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const RecordDetailDrawer = ({ open, onClose, recordId, moduleKey, onUpdated }) => {
  const { user: currentUser } = useAuth();
  const [record, setRecord]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  // Round-4 G1 (=R7): attachment count for the small chip in the header.
  const [attachmentCount, setAttachmentCount] = useState(0);

  // Workflow action dialog state
  const [wfOpen, setWfOpen]           = useState(false);
  const [wfAction, setWfAction]       = useState(null);       // 'submit' | 'approve' | etc.
  const [wfLabel, setWfLabel]         = useState('');
  const [wfTargetStatus, setWfTarget] = useState(null);       // for /transition

  const apis        = useMemo(() => MODULE_APIS[moduleKey] || {}, [moduleKey]);
  const commonSlug  = useMemo(() => MODULE_META[moduleKey]?.commonSlug, [moduleKey]);
  const isTerminal  = ['CLOSED', 'CANCELLED'].includes(record?.status);

  const fetchRecord = useCallback(async () => {
    if (!recordId || !apis.getById) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apis.getById(recordId);
      setRecord(data?.data || data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load record.');
    } finally {
      setLoading(false);
    }
  }, [recordId, apis]);

  useEffect(() => {
    if (open && recordId) fetchRecord();
    if (!open) setRecord(null);
  }, [open, recordId, fetchRecord]);

  // Round-4 G1 (=R7): fetch attachment count whenever the record (re)loads.
  // We refetch on every drawer open or refresh so the chip reflects uploads
  // that happened in the current session.
  useEffect(() => {
    if (!open || !recordId || !moduleKey) { setAttachmentCount(0); return; }
    const recordType = {
      changeControl: 'CHANGE_CONTROL', capa: 'CAPA',
      deviation: 'DEVIATION', incident: 'INCIDENT',
      marketComplaint: 'MARKET_COMPLAINT',
    }[moduleKey];
    if (!recordType) { setAttachmentCount(0); return; }
    listRecordAttachmentsApi(recordType, recordId)
      .then(({ data }) => setAttachmentCount((data?.data || []).length))
      .catch(() => setAttachmentCount(0));
  }, [open, recordId, moduleKey, record?.updatedAt]);

  // Open workflow action dialog
  const handleAction = (action, label, targetStatus = null) => {
    setWfAction(action);
    setWfLabel(label);
    setWfTarget(targetStatus);
    setWfOpen(true);
  };

  // Execute workflow action after comment confirmed
  const handleConfirm = async (comment) => {
    const fn = apis[wfAction];
    if (!fn) throw new Error(`No API for action: ${wfAction}`);

    if (wfAction === 'transition') {
      await apis.transition(recordId, { targetStatus: wfTargetStatus, comment });
    } else {
      await fn(recordId, comment);
    }
    await fetchRecord();   // refresh record in drawer
    onUpdated?.();         // refresh parent list
  };

  const refNum  = record?.recordNumber || record?.capaNumber || record?.deviationNumber
                || record?.incidentNumber || record?.complaintNumber || record?.ccNumber
                || `#${record?.id}`;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        PaperProps={{ sx: {
          display: 'flex',
          flexDirection: 'column',
          // Keep the dialog tall enough that the workflow stepper + several
          // StageSections + sticky action bar all fit without aggressive
          // internal scroll on a typical 1080p viewport.
          height: { xs: '100%', sm: '92vh' },
          maxHeight: { xs: '100%', sm: '92vh' },
        }}}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            {record && (
              <>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{refNum}</Typography>
                <Typography variant="h6" fontWeight={700} lineHeight={1.3} sx={{ mt: 0.25 }}>
                  {record.title}
                </Typography>
                {/* Round-3 R5: hide the status chip in DRAFT — the workflow
                    stepper below already shows "Initiation" at that stage and
                    the redundant chip clutters a half-empty record.
                    Round-3 R7: surface Change Type + attachment count on
                    every status. */}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                  {record.status !== 'DRAFT' && <StatusChip status={record.status} />}
                  {/* Round-5 H2: drop the default "Medium" priority chip.
                      Show a Risk Level chip ONLY after QA has set category. */}
                  {record.category && (
                    <Chip size="small"
                          label={`Risk: ${record.category}`}
                          color={record.category === 'Critical' ? 'error'
                               : record.category === 'Major'    ? 'warning'
                               : record.category === 'Minor'    ? 'info' : 'default'} />
                  )}
                  {moduleKey === 'changeControl' && record.changeType && (
                    <Chip size="small" variant="outlined" label={`Change Type: ${record.changeType}`} />
                  )}
                  {attachmentCount > 0 && (
                    <Chip size="small" variant="outlined" color="primary"
                          label={`${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`} />
                  )}
                  {record.overdue && <Chip label="Overdue" size="small" color="error" icon={<WarnIcon />} />}
                </Box>
              </>
            )}
            {!record && !loading && <Typography variant="h6" fontWeight={700}>Record Detail</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh"><IconButton size="small" onClick={fetchRecord} disabled={loading}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
            {/* Round-5 H1: Print / Save as PDF removed entirely.
                A proper server-side report endpoint (Round-2 E2 plan) would
                replace this if/when we ship a real CC dossier print. */}
            <Tooltip title="Close"><IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>}
          {error && <Alert severity="error">{error}</Alert>}

          {record && !loading && (
            <>
              {/* Workflow stage pipeline — visual position in the approval flow */}
              <WorkflowStageStepper moduleKey={moduleKey} status={record.status} />

              {/* Stage-aware action panel — Change Control only.
                  Renders the right inputs for the current status, then
                  bundles "save fields" and "transition" into one click. */}
              {moduleKey === 'changeControl' && (
                <ChangeControlStagePanel record={record} onUpdated={async () => {
                  await fetchRecord();
                  onUpdated?.();
                }} />
              )}

              {moduleKey === 'marketComplaint' && (
                <MarketComplaintStagePanel record={record} onUpdated={async () => {
                  await fetchRecord();
                  onUpdated?.();
                }} />
              )}

              {moduleKey === 'deviation' && (
                <DeviationStagePanel record={record} onUpdated={async () => {
                  await fetchRecord();
                  onUpdated?.();
                }} />
              )}

              {moduleKey === 'incident' && (
                <IncidentStagePanel record={record} onUpdated={async () => {
                  await fetchRecord();
                  onUpdated?.();
                }} />
              )}

              {moduleKey === 'capa' && (
                <CapaStagePanel record={record} onUpdated={async () => {
                  await fetchRecord();
                  onUpdated?.();
                }} />
              )}

              {/* Banners */}
              {record.deviationRequired && (
                <Alert severity="warning" sx={{ mb: 2 }} icon={<WarnIcon />}>
                  This incident requires a <strong>Deviation</strong> record to be opened.
                </Alert>
              )}

              {/* Common fields — Round-4 F3: hidden for the 5 modules whose
                  stage panel renders the linear flow. The Draft StageSection
                  already shows Raised By (via SectionStamp), Department,
                  Raised Date, Product/Material, Material Code etc. — and
                  the downstream StageSections show Closed Date / Approved By
                  / Approval Comments on the CLOSED + Head QA sections.
                  Showing them again here was duplicative.
                  Kept for modules with no linear flow yet (none currently). */}
              {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey) && (
                <Grid container spacing={2}>
                  <Grid item xs={6}><Field label="Raised By" value={record.raisedByName || record.createdBy} /></Grid>
                  {!isDraft(record.status) && (
                    <Grid item xs={6}><Field label="Assigned To" value={record.assignedToName} /></Grid>
                  )}
                  <Grid item xs={6}><Field label="Department" value={record.department} /></Grid>
                  {!isDraft(record.status) && (
                    <Grid item xs={6}><Field label="Due Date" value={formatDate(record.dueDate)} /></Grid>
                  )}
                  {record.createdAt && (
                    <Grid item xs={6}><Field label="Raised Date" value={formatDate(record.createdAt)} /></Grid>
                  )}
                  {record.closedDate && <Grid item xs={6}><Field label="Closed Date" value={formatDate(record.closedDate)} /></Grid>}
                  {record.approvedByName && <Grid item xs={6}><Field label="Approved By" value={record.approvedByName} /></Grid>}
                  {record.approvalComments && <Grid item xs={12}><Field label="Approval Comments" value={record.approvalComments} /></Grid>}
                  {!isDraft(record.status) && record.description && (
                    <Grid item xs={12}><Field label="Description" value={record.description} /></Grid>
                  )}
                </Grid>
              )}

              {/* Round-4 F4: for modules whose stage panel renders the
                  linear flow (CC / CAPA / Dev / Inc / MC), the drawer hides
                  every section that the linear flow already covers:
                    • Module Details (Initiation, Approval Routing, etc.)
                    • Risk & Customer
                    • Verification of Implementation
                    • Line Items accordion (lives inside Draft StageSection)
                    • Record Attachments (lives inside current StageSection)
                  Dept Comments accordion + Target Date Extension stay
                  because they're functional UIs (invite depts / request
                  extension), not just read-only summaries. */}
              {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey)
                && !isDraft(record.status) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                    Module Details
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <ModuleExtraFields moduleKey={moduleKey} record={record} />
                  </Box>
                </>
              )}

              {/* ── Common QMS sections — work uniformly for every module ──────── */}
              {commonSlug && recordId && (
                <>
                  {/* Risk + categorisation + customer block — Round-4 F4
                      hidden for linear-flow modules (RoQaPhase2View / QA
                      Decision Summary cover it). */}
                  {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey) &&
                   (record.initialAssessment || record.riskAssessment || record.category
                    || record.customerCommunicationRequired || record.customerComment) && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                                  letterSpacing={0.5} color="text.secondary">
                        Risk &amp; Customer
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 0.5, mb: 1 }}>
                        {record.category && <Grid item xs={6}><Field label="Category" value={record.category} /></Grid>}
                        {record.customerCommunicationRequired != null && (
                          <Grid item xs={6}>
                            <Field label="Customer Comm. Required"
                                   value={record.customerCommunicationRequired ? 'Yes' : 'No'} />
                          </Grid>
                        )}
                        {record.customerCommunicationRequired && record.customerRepresentative && (
                          <Grid item xs={6}><Field label="Customer Rep" value={record.customerRepresentative} /></Grid>
                        )}
                        {record.initialAssessment && (
                          <Grid item xs={12}><Field label="HOD Initial Assessment" value={record.initialAssessment} /></Grid>
                        )}
                        {record.riskAssessment && (
                          <Grid item xs={12}><Field label="QA Risk Assessment" value={record.riskAssessment} /></Grid>
                        )}
                        {record.customerComment && (
                          <Grid item xs={12}><Field label="Customer Comment" value={record.customerComment} /></Grid>
                        )}
                      </Grid>
                    </>
                  )}

                  {/* Verification phase — Round-4 F4 hidden for linear-flow
                      modules (RoVerificationView covers it). */}
                  {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey) &&
                   (record.verificationActionTaken || record.verificationEffectiveOn
                    || record.verificationDocumentsReissue != null
                    || record.verificationOtherComments
                    || record.verificationRegCommunication) && (
                    <>
                      <Typography variant="caption" fontWeight={700} textTransform="uppercase"
                                  letterSpacing={0.5} color="text.secondary">
                        Verification of Implementation
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 0.5, mb: 1 }}>
                        {record.verificationActionTaken && (
                          <Grid item xs={12}><Field label="Action Taken" value={record.verificationActionTaken} /></Grid>
                        )}
                        {record.verificationEffectiveOn && (
                          <Grid item xs={6}><Field label="Effective On" value={formatDate(record.verificationEffectiveOn)} /></Grid>
                        )}
                        {record.verificationDocumentsReissue != null && (
                          <Grid item xs={6}>
                            <Field label="Docs Reissue"
                                   value={record.verificationDocumentsReissue ? 'Yes' : 'No'} />
                          </Grid>
                        )}
                        {record.verificationRegCommunication && (
                          <Grid item xs={12}><Field label="Reg. Communication" value={record.verificationRegCommunication} /></Grid>
                        )}
                        {record.verificationOtherComments && (
                          <Grid item xs={12}><Field label="Other Comments" value={record.verificationOtherComments} /></Grid>
                        )}
                      </Grid>
                    </>
                  )}

                  {/* Line Items accordion — Round-4 F4 hidden for linear-flow
                      modules (RoDraftView mounts QmsLineItemsSection inline). */}
                  {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey) && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Accordion defaultExpanded disableGutters elevation={0}
                                 sx={{ '&:before': { display: 'none' }, border: '1px solid',
                                        borderColor: 'divider', borderRadius: 1.5, mb: 1.5 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2" fontWeight={700}>Line Items</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <QmsLineItemsSection
                            commonSlug={commonSlug}
                            recordId={recordId}
                            readOnly={isTerminal}
                          />
                        </AccordionDetails>
                      </Accordion>
                    </>
                  )}

                  {/* Stage attachments / Record Attachments — Round-4 F4
                      hidden for linear-flow modules (StageAttachments lives
                      inside the current StageSection's editable body). */}
                  {!['changeControl','capa','deviation','incident','marketComplaint'].includes(moduleKey) && recordId && (
                    <StageAttachments
                      moduleKey={moduleKey}
                      recordId={recordId}
                      readOnly={isTerminal}
                      heading="Record attachments"
                    />
                  )}

                  {/* Department comments — Round-2 B1: hidden in DRAFT and
                      PENDING_HOD because depts haven't been invited yet. At
                      PENDING_QA_REVIEW we DO show it (QA invites depts here)
                      and on every downstream stage as read-only history. */}
                  {!isPreQA(record.status) && (
                    <Accordion defaultExpanded disableGutters elevation={0}
                               sx={{ '&:before': { display: 'none' }, border: '1px solid',
                                      borderColor: 'divider', borderRadius: 1.5, mb: 1.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" fontWeight={700}>Department-Wise Comments</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <QmsDepartmentCommentsSection
                          commonSlug={commonSlug}
                          recordId={recordId}
                          currentUser={currentUser}
                          recordTargetDate={record?.targetCompletionDate}
                        />
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Target date extension — only meaningful once the target
                      completion date exists (set by QA). Hidden until then. */}
                  {!isPreQA(record.status) && record.targetCompletionDate && (
                    <Accordion disableGutters elevation={0}
                               sx={{ '&:before': { display: 'none' }, border: '1px solid',
                                      borderColor: 'divider', borderRadius: 1.5, mb: 1.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" fontWeight={700}>Target Date Extension</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <TargetDateExtensionPanel
                          commonSlug={commonSlug}
                          recordId={recordId}
                          currentTargetDate={record.targetCompletionDate}
                        />
                      </AccordionDetails>
                    </Accordion>
                  )}
                </>
              )}

              {/* Round-5 J2: Status History block removed for every module.
                  Each past StageSection now stamps actor + date and surfaces
                  the transition Remark / Justification (Round-5 H5), so the
                  separate timeline at the bottom is redundant. */}
            </>
          )}
        </Box>

        {/* Workflow buttons footer.
            Round-3 R14 + R30: For every module that has a per-stage embedded
            action bar (CC + CAPA + Deviation + Incident + MarketComplaint),
            hide this drawer footer at the stages where the panel renders its
            own bottom bar. DRAFT and terminal states have no panel buttons,
            so the drawer footer remains so the Initiator can Submit and so
            terminal records can be reopened. */}
        {record && (() => {
          // Round-5 I1: CC now has a DRAFT descriptor + Submit handler in
          // the panel, so DRAFT joins the panel-owns-buttons list (CC only).
          // Other modules' DRAFT still uses the drawer footer.
          const panelStages = [
            // Round-L (2026-06-27): PENDING_REVIEW added — every module's
            // panel now owns the action buttons at the peer-review stage
            // (Submit-to-HOD + Send-back-to-Initiator live on the
            // StickyActionBar). Without this the legacy drawer footer
            // also rendered an "Approve / Forward" button below.
            'PENDING_REVIEW',
            'PENDING_HOD','PENDING_QA_REVIEW','PENDING_DEPT_COMMENT',
            'PENDING_RA_REVIEW','PENDING_SITE_HEAD','PENDING_CUSTOMER_COMMENT',
            'PENDING_HEAD_QA','PENDING_INVESTIGATION','PENDING_ATTACHMENTS',
            'PENDING_VERIFICATION','PENDING_VERIFICATION_REVIEW',
          ];
          const ccOwnsDraft = moduleKey === 'changeControl' && record.status === 'DRAFT';
          const panelOwnsButtons = (['changeControl','capa','deviation',
                                     'incident','marketComplaint'].includes(moduleKey)
                                   && panelStages.includes(record.status))
                                 || ccOwnsDraft;
          if (panelOwnsButtons) return null;
          return (
            <Paper elevation={3} sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <WorkflowButtons record={record} moduleKey={moduleKey} onAction={handleAction} />
            </Paper>
          );
        })()}
      </Dialog>

      <WorkflowActionDialog
        open={wfOpen}
        onClose={() => setWfOpen(false)}
        onConfirm={handleConfirm}
        action={wfAction}
        actionLabel={wfLabel}
        recordTitle={record?.title}
      />
    </>
  );
};

export default RecordDetailDrawer;
