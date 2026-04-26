import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, Chip, Divider, IconButton, Tooltip,
  CircularProgress, Alert, Button, Stack, Paper, Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Warning as WarnIcon,
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
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS,
  BRANCH_TRANSITIONS, DANGER_TRANSITIONS, getPrimaryForward, ACTION_LABELS,
} from './qmsConstants';
import WorkflowActionDialog from './WorkflowActionDialog';
import { formatDate } from '../../utils/helpers';

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

const PriorityChip = ({ priority }) => (
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
const ModuleExtraFields = ({ moduleKey, record }) => {
  if (!record) return null;
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
      return (
        <Grid container spacing={1}>
          <Grid item xs={6}><Field label="Change Type" value={record.changeType} /></Grid>
          <Grid item xs={6}><Field label="Risk Level" value={record.riskLevel} /></Grid>
          <Grid item xs={6}><Field label="Validation Required" value={record.validationRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={6}><Field label="Regulatory Submission" value={record.regulatorySubmissionRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={6}><Field label="Site Head Required" value={record.siteHeadRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={6}><Field label="Customer Comment Req." value={record.customerCommentRequired ? 'Yes' : 'No'} /></Grid>
          <Grid item xs={12}><Field label="Change Reason" value={record.changeReason} /></Grid>
          <Grid item xs={12}><Field label="Risk Assessment" value={record.riskAssessment} /></Grid>
          <Grid item xs={12}><Field label="Implementation Plan" value={record.implementationPlan} /></Grid>
          {record.customerComment && <Grid item xs={12}><Field label="Customer Comment" value={record.customerComment} /></Grid>}
        </Grid>
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
const StatusHistoryTimeline = ({ history }) => {
  if (!history?.length) return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No history yet.</Typography>
  );
  return (
    <Box>
      {history.map((h, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          {/* dot + connector */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${STATUS_COLORS[h.toStatus] || 'grey'}.main`, flexShrink: 0 }} />
            {i < history.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
          </Box>
          {/* content */}
          <Box sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label={STATUS_LABELS[h.toStatus] || h.toStatus} size="small" color={STATUS_COLORS[h.toStatus] || 'default'} />
              <Typography variant="caption" color="text.secondary">
                by <strong>{h.changedByUsername}</strong> · {formatDate(h.changedAt)}
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
      {/* Submit — from DRAFT */}
      {status === 'DRAFT' && (
        <Button variant="contained" size="small" color="primary"
          onClick={() => onAction('submit', 'Submit for Review')}>
          Submit for Review
        </Button>
      )}

      {/* Approve / Forward — canonical next step */}
      {primaryForward.length > 0 && (
        <Button variant="contained" size="small" color="success"
          onClick={() => onAction('approve', 'Approve / Forward')}>
          Approve / Forward
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

      {/* Reject */}
      {allowedTransitions.includes('REJECTED') && (
        <Button variant="outlined" size="small" color="error"
          onClick={() => onAction('reject', 'Reject / Send Back')}>
          Reject
        </Button>
      )}

      {/* Cancel */}
      {allowedTransitions.includes('CANCELLED') && (
        <Button variant="outlined" size="small" color="error"
          onClick={() => onAction('cancel', 'Cancel Record')}>
          Cancel
        </Button>
      )}

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
  const [record, setRecord]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Workflow action dialog state
  const [wfOpen, setWfOpen]           = useState(false);
  const [wfAction, setWfAction]       = useState(null);       // 'submit' | 'approve' | etc.
  const [wfLabel, setWfLabel]         = useState('');
  const [wfTargetStatus, setWfTarget] = useState(null);       // for /transition

  const apis = MODULE_APIS[moduleKey] || {};

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
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 640 }, display: 'flex', flexDirection: 'column' } }}
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
                <Box sx={{ display: 'flex', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                  <StatusChip status={record.status} />
                  {record.priority && <PriorityChip priority={record.priority} />}
                  {record.overdue && <Chip label="Overdue" size="small" color="error" icon={<WarnIcon />} />}
                </Box>
              </>
            )}
            {!record && !loading && <Typography variant="h6" fontWeight={700}>Record Detail</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh"><IconButton size="small" onClick={fetchRecord} disabled={loading}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Close"><IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>}
          {error && <Alert severity="error">{error}</Alert>}

          {record && !loading && (
            <>
              {/* Banners */}
              {record.deviationRequired && (
                <Alert severity="warning" sx={{ mb: 2 }} icon={<WarnIcon />}>
                  This incident requires a <strong>Deviation</strong> record to be opened.
                </Alert>
              )}

              {/* Common fields */}
              <Grid container spacing={2}>
                <Grid item xs={6}><Field label="Raised By" value={record.raisedByName || record.createdBy} /></Grid>
                <Grid item xs={6}><Field label="Assigned To" value={record.assignedToName} /></Grid>
                <Grid item xs={6}><Field label="Department" value={record.department} /></Grid>
                <Grid item xs={6}><Field label="Due Date" value={formatDate(record.dueDate)} /></Grid>
                {record.closedDate && <Grid item xs={6}><Field label="Closed Date" value={formatDate(record.closedDate)} /></Grid>}
                {record.approvedByName && <Grid item xs={6}><Field label="Approved By" value={record.approvedByName} /></Grid>}
                {record.approvalComments && <Grid item xs={12}><Field label="Approval Comments" value={record.approvalComments} /></Grid>}
                <Grid item xs={12}><Field label="Description" value={record.description} /></Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Module-specific fields */}
              <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                Module Details
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <ModuleExtraFields moduleKey={moduleKey} record={record} />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Status History */}
              <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                Status History
              </Typography>
              <Box sx={{ mt: 1 }}>
                <StatusHistoryTimeline history={record.statusHistory} />
              </Box>
            </>
          )}
        </Box>

        {/* Workflow buttons footer */}
        {record && (
          <Paper elevation={3} sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <WorkflowButtons record={record} moduleKey={moduleKey} onAction={handleAction} />
          </Paper>
        )}
      </Drawer>

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
