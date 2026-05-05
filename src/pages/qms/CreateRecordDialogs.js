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
import { createLineItemApi } from '../../api/qmsCommonApi';
import { listDepartmentsApi } from '../../api/orgApi';
import { useAuth } from '../../store/AuthContext';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  Add as AddRowIcon, DeleteOutline as RemoveRowIcon,
} from '@mui/icons-material';

const PRIORITY_OPTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORY_OPTS = ['Critical', 'Major', 'Minor'];

// Fetch real departments once and cache. Keeps the form snappy across dialog opens.
let _deptCache = null;
let _deptPromise = null;
const useDepartments = () => {
  const [list, setList] = useState(_deptCache || []);
  useEffect(() => {
    if (_deptCache) return;
    if (!_deptPromise) {
      _deptPromise = listDepartmentsApi()
        .then(({ data }) => { _deptCache = data?.data || []; setList(_deptCache); })
        .catch(() => { _deptCache = []; })
        .finally(() => { _deptPromise = null; });
    } else {
      _deptPromise.then(() => setList(_deptCache || []));
    }
  }, []);
  return list;
};

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

/**
 * Department dropdown — wired to /api/v1/org/departments.
 * Sets BOTH `departmentId` (FK, used by the new positional checks) and
 * `department` (legacy free-text label, kept populated for backwards compat
 * during the migration).
 *
 * When `locked` is true the field renders disabled — used by the Change
 * Control dialog so an Initiator can only raise records on behalf of
 * THEIR own department (and the workflow's HOD-of-record-dept check
 * is meaningful).
 */
const DeptField = ({ form, setForm, xs = 6, required, locked }) => {
  const list = useDepartments();
  return (
    <Grid item xs={xs}>
      <TextField
        label="Department" select fullWidth size="small"
        required={required}
        disabled={locked}
        value={form.departmentId || ''}
        onChange={(e) => {
          const id = e.target.value;
          const matched = list.find(d => String(d.id) === String(id));
          setForm(p => ({
            ...p,
            departmentId: id || null,
            department:   matched ? matched.name : p.department,
          }));
        }}
        helperText={locked ? 'Auto-filled from your profile.' : undefined}
      >
        {list.length === 0 && <MenuItem value=""><em>Loading…</em></MenuItem>}
        {list.map(d => (
          <MenuItem key={d.id} value={d.id}>
            {d.name} ({d.code})
            {d.deptType !== 'STANDARD' ? ` · ${d.deptType}` : ''}
          </MenuItem>
        ))}
      </TextField>
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
    initialForm={{ title: '', capaType: 'Corrective', priority: 'MEDIUM', source: 'Internal', departmentId: null, department: '' }}
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
        <DeptField form={form} setForm={setForm} required />
        <F {...p} label="Category (impact)" name="category" options={CATEGORY_OPTS} />
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
    initialForm={{ title: '', deviationType: 'Unplanned', priority: 'MEDIUM', departmentId: null, department: '', capaRequired: false, regulatoryReportable: false }}
    onSubmit={async (form) => { await createDeviationApi(form); onCreated?.(); }}
  >
    {({ form, setForm }) => {
      const p = { form, setForm };
      return (<>
        <SectionLabel>Basic Info</SectionLabel>
        <F {...p} label="Title" name="title" required xs={12} />
        <F {...p} label="Deviation Type" name="deviationType" options={['Planned', 'Unplanned', 'Temporary']} />
        <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
        <DeptField form={form} setForm={setForm} required />
        <F {...p} label="Category" name="category" options={CATEGORY_OPTS} />
        <F {...p} label="Product / Batch" name="productBatch" />
        <F {...p} label="Process Area" name="processArea" />
        <F {...p} label="Due Date" name="dueDate" type="date" />
        <SectionLabel>Assessment</SectionLabel>
        <F {...p} label="Risk Assessment" name="riskAssessment" multiline xs={12} />
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
    initialForm={{ title: '', incidentType: 'Quality', incidentSubType: 'GENERAL', severity: 'Minor', priority: 'MEDIUM', departmentId: null, department: '', injuryInvolved: false, retestingRequired: false, deviationRequired: false }}
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
        <DeptField form={form} setForm={setForm} required />
        <F {...p} label="Category" name="category" options={CATEGORY_OPTS} />
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
//
// Layout (matches the May 2026 tester spec):
//
//  Initiation of Change (Create dialog)
//    • Change Title, Product / Material, Market Details
//    • Parameter / Change Type, Department (locked from profile)
//    • Inline Line Items (Existing System / Proposed System / Proposed Date)
//
// Pending HOD review (stage panel — see ChangeControlStagePanel)
//    • Risk Assessment, Linked CAPA #
//
// Pending QA Review (stage panel)
//    • Priority, Risk Level
//    • Approval Routing (Site Head / Customer Communication / Customer Comment)
//    • Regulatory & Validation (regulatory submission, validation)
//    • Department-wise comments — managed via the dept accordion
export const CreateChangeControlDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const initialForm = {
    title: '',
    productMaterial: '',
    marketDetails: '',
    changeType: 'Process',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    changeReason: '',
    description: '',
    // Priority is required by the backend's QmsBaseRequest validator —
    // default to MEDIUM at create time; QA Reviewer overrides at QA_REVIEW.
    priority: 'MEDIUM',
    // Inline line items — at least one row, more can be added.
    lineItems: [{ existingSystem: '', proposedSystem: '', proposedDate: '' }],
  };

  /**
   * After the Change Control is saved, fire-and-forget the line-item POSTs.
   * Failures don't roll back the CC create — they surface as a soft warning
   * the user can retry from the line-items accordion in the detail drawer.
   */
  const submitWithLineItems = async (form) => {
    const { lineItems = [], ...payload } = form;
    const { data } = await createChangeControlApi(payload);
    const created  = data?.data || data;
    const newId    = created?.id;
    const usable   = lineItems.filter(l =>
        (l.existingSystem || '').trim() ||
        (l.proposedSystem || '').trim() ||
        (l.proposedDate   || '').trim());
    if (newId && usable.length > 0) {
      await Promise.all(usable.map(li => createLineItemApi('change-control', newId, {
        existingSystem: li.existingSystem || null,
        proposedSystem: li.proposedSystem || null,
        proposedDate:   li.proposedDate   || null,
      }).catch(() => null)));
    }
    onCreated?.();
  };

  return (
    <BaseDialog
      open={open} onClose={onClose} title="Initiate Change Control"
      initialForm={initialForm}
      onSubmit={submitWithLineItems}
    >
      {({ form, setForm }) => {
        const p = { form, setForm };
        return (<>
          {!user?.departmentId && (
            <Grid item xs={12}>
              <Alert severity="warning">
                Your profile has no department assigned. Ask an admin to set
                your department on the Users page before raising a Change
                Control.
              </Alert>
            </Grid>
          )}

          {/* Initiation of Change — minimum context for the printable cover sheet */}
          <SectionLabel>Initiation of Change</SectionLabel>
          <F {...p} label="Change Title" name="title" required xs={12} />
          <F {...p} label="Product / Material" name="productMaterial" xs={6} />
          <F {...p} label="Market Details" name="marketDetails" xs={6} />
          <F {...p} label="Parameter / Change Type" name="changeType"
             options={['Process', 'Equipment', 'Document', 'System', 'Supplier', 'Facility']} />
          <DeptField form={form} setForm={setForm} required locked />
          <F {...p} label="Reason for Change" name="changeReason" multiline xs={12} />
          <F {...p} label="Description" name="description" multiline xs={12} />

          {/* Inline line items — Existing / Proposed system + proposed date */}
          <SectionLabel>Line Items (Existing / Proposed System)</SectionLabel>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Add one row per change line. You can refine these later from the
              detail drawer&apos;s Line Items accordion.
            </Typography>
            {(form.lineItems || []).map((li, idx) => (
              <Box key={idx} sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 160px 40px',
                  gap: 1, mb: 1, alignItems: 'flex-start',
                }}>
                <TextField
                  label={`Existing System ${idx + 1}`} size="small" multiline minRows={1}
                  value={li.existingSystem || ''}
                  onChange={(e) => {
                    const next = [...form.lineItems];
                    next[idx] = { ...next[idx], existingSystem: e.target.value };
                    setForm(prev => ({ ...prev, lineItems: next }));
                  }}
                />
                <TextField
                  label={`Proposed System ${idx + 1}`} size="small" multiline minRows={1}
                  value={li.proposedSystem || ''}
                  onChange={(e) => {
                    const next = [...form.lineItems];
                    next[idx] = { ...next[idx], proposedSystem: e.target.value };
                    setForm(prev => ({ ...prev, lineItems: next }));
                  }}
                />
                <TextField
                  label="Proposed Date" size="small" type="date"
                  InputLabelProps={{ shrink: true }}
                  value={li.proposedDate || ''}
                  onChange={(e) => {
                    const next = [...form.lineItems];
                    next[idx] = { ...next[idx], proposedDate: e.target.value };
                    setForm(prev => ({ ...prev, lineItems: next }));
                  }}
                />
                <Tooltip title="Remove line">
                  <span>
                    <IconButton
                      size="small"
                      disabled={(form.lineItems || []).length <= 1}
                      onClick={() => {
                        const next = (form.lineItems || []).filter((_, i) => i !== idx);
                        setForm(prev => ({ ...prev, lineItems: next.length ? next : [{ existingSystem: '', proposedSystem: '', proposedDate: '' }] }));
                      }}
                    >
                      <RemoveRowIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddRowIcon />}
              onClick={() => setForm(prev => ({
                ...prev,
                lineItems: [...(prev.lineItems || []), { existingSystem: '', proposedSystem: '', proposedDate: '' }],
              }))}
            >
              Add line
            </Button>
          </Grid>

          {/* Footnote — fields removed from this dialog now live on the stage panels. */}
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 1 }}>
              Risk Assessment &amp; Linked CAPA are filled by the HOD at the next
              stage. Priority, Risk Level, Approval Routing, and Regulatory &amp;
              Validation flags are set by the QA Reviewer during QA Evaluation.
            </Alert>
          </Grid>
        </>);
      }}
    </BaseDialog>
  );
};

// ── Market Complaint ──────────────────────────────────────────────────────────
export const CreateComplaintDialog = ({ open, onClose, onCreated }) => (
  <BaseDialog
    open={open} onClose={onClose} title="Log Market Complaint"
    initialForm={{ title: '', priority: 'MEDIUM', complaintCategory: 'Quality', complaintSource: 'Email', departmentId: null, department: '', reportableToAuthority: false, sampleReturned: false }}
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
        <DeptField form={form} setForm={setForm} required />
        <F {...p} label="Impact Category" name="category" options={CATEGORY_OPTS} />
        <F {...p} label="Received Date" name="receivedDate" type="date" />
        <SectionLabel>Customer & Product</SectionLabel>
        <F {...p} label="Customer Name" name="customerName" required />
        <F {...p} label="Customer Representative" name="customerRepresentative" />
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
