/**
 * Per-module Create dialogs.
 * Each dialog captures the full request body documented in the API spec.
 * They only CREATE the record (→ DRAFT). The user then submits from the detail drawer.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, TextField, MenuItem, Divider, Typography,
  FormControlLabel, Switch, Alert,
} from '@mui/material';
import {
  createCapaApi, createDeviationApi, createIncidentApi,
  createComplaintApi, createChangeControlApi,
} from '../../api/qmsApi';

const PRIORITY_OPTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const DEPT_OPTS     = ['QA', 'Production', 'Warehouse', 'Packaging', 'Lab', 'Regulatory', 'Manufacturing'];

// ── Reusable field helpers ────────────────────────────────────────────────────
const F = ({ label, name, form, setForm, type = 'text', options, multiline, required, xs = 6, shrinkLabel }) => {
  const val = form[name] ?? '';
  const common = {
    label, fullWidth: true, size: 'small', required,
    value: val,
    onChange: (e) => setForm((p) => ({ ...p, [name]: e.target.value })),
  };
  return (
    <Grid item xs={xs}>
      {options ? (
        <TextField {...common} select>
          {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      ) : (
        <TextField
          {...common}
          type={type}
          multiline={multiline}
          rows={multiline ? 3 : undefined}
          InputLabelProps={type === 'date' || shrinkLabel ? { shrink: true } : undefined}
        />
      )}
    </Grid>
  );
};

const SW = ({ label, name, form, setForm, xs = 6 }) => (
  <Grid item xs={xs}>
    <FormControlLabel
      control={
        <Switch
          checked={!!form[name]}
          onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.checked }))
          }
          size="small"
        />
      }
      label={<Typography variant="body2">{label}</Typography>}
    />
  </Grid>
);

const SectionLabel = ({ children }) => (
  <Grid item xs={12}>
    <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
      {children}
    </Typography>
    <Divider sx={{ mt: 0.5 }} />
  </Grid>
);

const BaseDialog = ({ open, onClose, title, initialForm, onSubmit, children }) => {
  const [form, setForm]     = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => { if (open) { setForm(initialForm); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          {children({ form, setForm })}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.title?.trim()}>
          {saving ? 'Creating…' : 'Create (Draft)'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── CAPA ──────────────────────────────────────────────────────────────────────
export const CreateCapaDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Create CAPA"
    initialForm={{ title: '', capaType: 'Corrective', priority: 'MEDIUM', source: 'Internal', department: 'QA' }}
    onSubmit={async (form) => { await createCapaApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Basic Info</SectionLabel>
        <F {...p} label="Title" name="title" required xs={12} />
        <F {...p} label="CAPA Type" name="capaType" options={['Corrective', 'Preventive']} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <F {...p} label="Source" name="source" options={['Audit', 'Customer', 'Internal', 'Regulatory']} />
        <F {...p} label="Department" name="department" options={DEPT_OPTS} />
        <F {...p} label="Due Date" name="dueDate" type="date" />
        <F {...p} label="Target Completion Date" name="targetCompletionDate" type="date" />
        <F {...p} label="Effectiveness Check Date" name="effectivenessCheckDate" type="date" />
        <F {...p} label="Linked Deviation Number" name="linkedDeviationNumber" />
        <SectionLabel>Root Cause & Actions</SectionLabel>
        <F {...p} label="Root Cause" name="rootCause" multiline xs={12} />
        <F {...p} label="Corrective Action" name="correctiveAction" multiline xs={12} />
        <F {...p} label="Preventive Action" name="preventiveAction" multiline xs={12} />
        <F {...p} label="Description / Notes" name="description" multiline xs={12} />
      </>);
    }}
  </BaseDialog>
);

// ── Deviation ─────────────────────────────────────────────────────────────────
export const CreateDeviationDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Report Deviation"
    initialForm={{ title: '', deviationType: 'Unplanned', priority: 'MEDIUM', department: 'QA', capaRequired: false, regulatoryReportable: false }}
    onSubmit={async (form) => { await createDeviationApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Basic Info</SectionLabel>
        <F {...p} label="Title" name="title" required xs={12} />
        <F {...p} label="Deviation Type" name="deviationType" options={['Planned', 'Unplanned', 'Temporary']} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <F {...p} label="Department" name="department" options={DEPT_OPTS} />
        <F {...p} label="Product / Batch" name="productBatch" />
        <F {...p} label="Process Area" name="processArea" />
        <F {...p} label="Due Date" name="dueDate" type="date" />
        <SectionLabel>Assessment</SectionLabel>
        <F {...p} label="Impact Assessment" name="impactAssessment" multiline xs={12} />
        <SW {...p} label="CAPA Required" name="capaRequired" />
        <SW {...p} label="Regulatory Reportable" name="regulatoryReportable" />
        <F {...p} label="Description" name="description" multiline xs={12} />
      </>);
    }}
  </BaseDialog>
);

// ── Incident ──────────────────────────────────────────────────────────────────
export const CreateIncidentDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Report Incident"
    initialForm={{ title: '', incidentType: 'Quality', incidentSubType: 'GENERAL', severity: 'Minor', priority: 'MEDIUM', injuryInvolved: false, retestingRequired: false, deviationRequired: false }}
    onSubmit={async (form) => { await createIncidentApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Basic Info</SectionLabel>
        <F {...p} label="Title" name="title" required xs={12} />
        <F {...p} label="Incident Type" name="incidentType" options={['Safety', 'Quality', 'Environmental', 'Equipment', 'Personnel']} />
        <F {...p} label="Sub-Type" name="incidentSubType" options={['LABORATORY', 'GENERAL']} />
        <F {...p} label="Severity" name="severity" options={['Minor', 'Major', 'Critical']} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <F {...p} label="Location" name="location" required />
        <F {...p} label="Occurrence Date" name="occurrenceDate" type="date" />
        <F {...p} label="Reported By" name="reportedBy" />
        <SectionLabel>Details</SectionLabel>
        <F {...p} label="Immediate Action Taken" name="immediateAction" multiline xs={12} />
        <SW {...p} label="Injury Involved" name="injuryInvolved" />
        <SW {...p} label="Retesting Required (Lab)" name="retestingRequired" />
        <SW {...p} label="Deviation Required" name="deviationRequired" />
        <F {...p} label="Description" name="description" multiline xs={12} />
      </>);
    }}
  </BaseDialog>
);

// ── Change Control ────────────────────────────────────────────────────────────
export const CreateChangeControlDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Initiate Change Control"
    initialForm={{ title: '', changeType: 'Process', riskLevel: 'Medium', priority: 'MEDIUM', validationRequired: false, regulatorySubmissionRequired: false, siteHeadRequired: false, customerCommentRequired: false }}
    onSubmit={async (form) => { await createChangeControlApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Basic Info</SectionLabel>
        <F {...p} label="Change Title" name="title" required xs={12} />
        <F {...p} label="Change Type" name="changeType" options={['Process', 'Equipment', 'Document', 'System', 'Supplier', 'Facility']} />
        <F {...p} label="Risk Level" name="riskLevel" options={['Low', 'Medium', 'High']} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <F {...p} label="Implementation Date" name="implementationDate" type="date" />
        <SectionLabel>Risk & Planning</SectionLabel>
        <F {...p} label="Reason for Change" name="changeReason" multiline xs={12} />
        <F {...p} label="Risk Assessment" name="riskAssessment" multiline xs={12} />
        <F {...p} label="Implementation Plan" name="implementationPlan" multiline xs={12} />
        <F {...p} label="Rollback Plan" name="rollbackPlan" multiline xs={12} />
        <SectionLabel>Approval Routing</SectionLabel>
        <SW {...p} label="Validation Required" name="validationRequired" />
        <SW {...p} label="Regulatory Submission Required" name="regulatorySubmissionRequired" />
        <SW {...p} label="Site Head Approval Required" name="siteHeadRequired" />
        <SW {...p} label="Customer Comment Required" name="customerCommentRequired" />
        <F {...p} label="Description" name="description" multiline xs={12} />
      </>);
    }}
  </BaseDialog>
);

// ── Market Complaint ──────────────────────────────────────────────────────────
export const CreateComplaintDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Log Market Complaint"
    initialForm={{ title: '', priority: 'MEDIUM', complaintCategory: 'Quality', complaintSource: 'Email', reportableToAuthority: false, sampleReturned: false }}
    onSubmit={async (form) => { await createComplaintApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Complaint Details</SectionLabel>
        <F {...p} label="Complaint Title" name="title" required xs={12} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <F {...p} label="Category" name="complaintCategory" options={['Quality', 'Safety', 'Regulatory', 'Labeling']} />
        <F {...p} label="Source" name="complaintSource" options={['Email', 'Phone', 'Portal', 'Regulatory']} />
        <F {...p} label="Received Date" name="receivedDate" type="date" />
        <SectionLabel>Customer & Product</SectionLabel>
        <F {...p} label="Customer Name" name="customerName" required />
        <F {...p} label="Country" name="customerCountry" />
        <F {...p} label="Product Name" name="productName" required />
        <F {...p} label="Batch Number" name="batchNumber" />
        <SW {...p} label="Reportable to Authority" name="reportableToAuthority" />
        <SW {...p} label="Sample Returned" name="sampleReturned" />
        <F {...p} label="Description" name="description" multiline xs={12} />
      </>);
    }}
  </BaseDialog>
);
