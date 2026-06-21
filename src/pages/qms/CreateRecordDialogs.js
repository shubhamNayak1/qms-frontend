/**
 * Per-module Create dialogs.
 * Each dialog captures the full request body documented in the API spec.
 * They only CREATE the record (→ DRAFT). The user then submits from the detail drawer.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, TextField, MenuItem, Divider, Typography,
  FormControlLabel, Switch, Alert, Autocomplete,
} from '@mui/material';
import {
  createCapaApi, createDeviationApi, createIncidentApi,
  createComplaintApi, createChangeControlApi,
  getIncidentsApi, getDeviationsApi, getComplaintsApi, getChangeControlsApi,
} from '../../api/qmsApi';
import { createLineItemApi, uploadRecordAttachmentApi } from '../../api/qmsCommonApi';
import { listDepartmentsApi } from '../../api/orgApi';
import ESignDialog from '../../components/ESignDialog';
import { getDocumentsApi } from '../../api/dmsApi';
import { useAuth } from '../../store/AuthContext';
import { Box, IconButton, Tooltip, Chip, Stack } from '@mui/material';
import {
  Add as AddRowIcon, DeleteOutline as RemoveRowIcon,
  CloudUpload as UploadIcon, AttachFile as AttachFileIcon,
  Close as ClearIcon,
} from '@mui/icons-material';

const PRIORITY_OPTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Tiny Error subclass that mirrors the axios error shape the BaseDialog's
 * onSubmit handler reads ({@code err.response?.data?.message}). Lets a
 * dialog reject submission with a friendly message without bypassing
 * eslint's no-throw-literal rule.
 */
class FormValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormValidationError';
    this.response = { data: { message } };
  }
}

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
          /* Round-4 G2 (=R11): every date input carries DD/MM/YYYY hint. */
          helperText={type === 'date' ? 'DD/MM/YYYY' : undefined}
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

const BaseDialog = ({ open, onClose, title, initialForm, onSubmit, children, skipESign = false }) => {
  const [form, setForm]     = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  // Round-3 R3 / R30: e-sign gate before creating any QMS draft record.
  // The CC dialog wraps its own confirm + e-sign flow, so it passes
  // skipESign={true} to suppress this. Every other module uses this gate.
  const [eSignOpen, setESignOpen] = useState(false);
  // Round-2 A2: a synchronous ref-based guard that survives the gap between
  // click and React's re-render. Without it, a rapid double-click on a slow
  // network can fire onSubmit twice and the backend creates two records.
  const inFlight = React.useRef(false);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError(null);
      setESignOpen(false);
      inFlight.current = false;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage 1: user clicked Create — open e-sign (or skip straight to persist).
  const handleSave = () => {
    if (skipESign) { handlePersist(); return; }
    setError(null);
    setESignOpen(true);
  };

  // Stage 2: e-sign succeeded (or skipESign was set) — actually persist.
  const handlePersist = async () => {
    if (inFlight.current) return; // synchronous guard
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      setESignOpen(false);
      onClose();
    } catch (err) {
      setESignOpen(false);
      setError(err.response?.data?.message || 'Failed to create record.');
    } finally {
      setSaving(false);
      // small delay before re-arming so an instant 2nd click after the
      // error message still hits the guard
      setTimeout(() => { inFlight.current = false; }, 300);
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
          {saving ? 'Creating…' : skipESign ? 'Create (Draft)' : 'Sign & Create (Draft)'}
        </Button>
      </DialogActions>

      {/* Round-3 R30 — e-sign gate for every module's Create dialog. */}
      <ESignDialog
        open={eSignOpen}
        onClose={() => !saving && setESignOpen(false)}
        onSigned={handlePersist}
        meaning={`Create draft — ${title}`}
        actionLabel={saving ? 'Saving…' : 'Sign & create draft'}
      />
    </Dialog>
  );
};

// ── CAPA ──────────────────────────────────────────────────────────────────────
//
// Per Kedar-sir spec, CAPA has two creation modes:
//   • NEW       — fresh, no parent record (e.g. process improvement).
//   • EXISTING  — raised against an Incident / Deviation / Change Control /
//                 Market Complaint where the HOD or QA Reviewer ticked
//                 "CAPA Required = Yes". The parent record is picked from
//                 a single combined dropdown that lists all four types
//                 with a "From" chip showing the source module.
//
// Fields that move to later stages (filled via the stage panel):
//   • CAPA Type, Source, Initial Remedial Action, Preventive Action      → PENDING_HOD
//   • Site Head Required                                                  → PENDING_QA_REVIEW (2nd pass)
//   • Action Taken / Effective Document                                   → PENDING_VERIFICATION
//   • Verification Review narrative                                       → PENDING_VERIFICATION_REVIEW
//   • Effectiveness Frequency + Count                                     → CLOSED (Head QA)
const CAPA_PARENT_TYPES = [
  { type: 'INCIDENT',         label: 'Incident',          color: 'info' },
  { type: 'DEVIATION',        label: 'Deviation',         color: 'warning' },
  { type: 'CHANGE_CONTROL',   label: 'Change Control',    color: 'primary' },
  { type: 'MARKET_COMPLAINT', label: 'Market Complaint',  color: 'secondary' },
];

const useCapaEligibleParents = (enabled) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) { setList([]); return; }
    setLoading(true);
    Promise.allSettled([
      getIncidentsApi({ size: 200 }).then(({ data }) => ({
        type: 'INCIDENT',
        rows: (data?.data?.content || data?.data || [])
              .filter(r => r?.capaRequired === true && !r?.linkedCapaNumber),
      })),
      getDeviationsApi({ size: 200 }).then(({ data }) => ({
        type: 'DEVIATION',
        rows: (data?.data?.content || data?.data || [])
              .filter(r => r?.capaRequired === true && !r?.linkedCapaNumber),
      })),
      getChangeControlsApi({ size: 200 }).then(({ data }) => ({
        type: 'CHANGE_CONTROL',
        rows: (data?.data?.content || data?.data || [])
              .filter(r => !r?.linkedCapaNumber),
      })),
      getComplaintsApi({ size: 200 }).then(({ data }) => ({
        type: 'MARKET_COMPLAINT',
        rows: (data?.data?.content || data?.data || [])
              .filter(r => r?.capaRequired === true && !r?.capaReference),
      })),
    ]).then(results => {
      const combined = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.rows) {
          r.value.rows.forEach(row => combined.push({
            type: r.value.type,
            id: row.id,
            recordNumber: row.recordNumber,
            title: row.title,
            departmentId: row.departmentId,
            departmentName: row.department || row.departmentName,
          }));
        }
      });
      setList(combined);
    }).finally(() => setLoading(false));
  }, [enabled]);
  return { list, loading };
};

export const CreateCapaDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const initialForm = {
    title: '',
    capaOrigin: 'NEW',
    parentRecordType: null,
    parentRecordId: null,
    parentRecordNumber: '',
    capaType: 'Corrective',
    priority: 'MEDIUM',
    source: 'Internal',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    description: '',
  };

  return (
    <BaseDialog
      open={open} onClose={onClose} title="Create CAPA"
      initialForm={initialForm}
      onSubmit={async (form) => {
        if (form.capaOrigin === 'EXISTING' && !form.parentRecordId) {
          throw new FormValidationError(
              'Pick a parent record (Incident / Deviation / CC / Market Complaint) for an Existing CAPA.');
        }
        await createCapaApi(form);
        onCreated?.();
      }}
    >
      {({ form, setForm }) => {
        const p = { form, setForm };
        const isExisting = form.capaOrigin === 'EXISTING';
        return (
          <CapaDialogBody p={p} form={form} setForm={setForm}
                          isExisting={isExisting} user={user} />
        );
      }}
    </BaseDialog>
  );
};

const CapaDialogBody = ({ p, form, setForm, isExisting, user }) => {
  const { list, loading } = useCapaEligibleParents(isExisting);

  return (<>
    {!user?.departmentId && (
      <Grid item xs={12}>
        <Alert severity="warning">
          Your profile has no department assigned. Ask an admin to set
          your department on the Users page before raising a CAPA.
        </Alert>
      </Grid>
    )}

    <SectionLabel>Origin</SectionLabel>
    <F {...p} label="CAPA Origin" name="capaOrigin"
       options={['NEW', 'EXISTING']} xs={6} />
    {isExisting && (
      <Grid item xs={12}>
        <TextField
          label="Parent Record" select required fullWidth size="small"
          value={form.parentRecordId || ''}
          onChange={(e) => {
            const id = e.target.value;
            const matched = list.find(r => String(r.id) === String(id));
            setForm(prev => ({
              ...prev,
              parentRecordId: id || null,
              parentRecordType: matched?.type || null,
              parentRecordNumber: matched?.recordNumber || '',
              // Pre-fill dept from parent (CAPA inherits the parent's dept).
              departmentId: matched?.departmentId || prev.departmentId,
              department:   matched?.departmentName || prev.department,
            }));
          }}
          helperText={loading
            ? 'Loading eligible parent records…'
            : list.length === 0
              ? 'No Incident / Deviation / CC / MC is currently flagged as CAPA Required (and not yet linked). Use NEW or wait for the upstream module to flag one.'
              : 'CAPA inherits the parent record\'s department.'}
        >
          {loading && <MenuItem value=""><em>Loading…</em></MenuItem>}
          {list.map(r => {
            const meta = CAPA_PARENT_TYPES.find(t => t.type === r.type);
            return (
              <MenuItem key={`${r.type}-${r.id}`} value={r.id}>
                [{meta?.label || r.type}] {r.recordNumber} — {r.title}
              </MenuItem>
            );
          })}
        </TextField>
      </Grid>
    )}

    <SectionLabel>Basic Info</SectionLabel>
    <F {...p} label="Title" name="title" required xs={12} />
    <F {...p} label="CAPA Type" name="capaType"
       options={['Corrective', 'Preventive', 'Both']} />
    <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
    <F {...p} label="Source" name="source"
       options={['Audit', 'Customer', 'Internal', 'Regulatory', 'Incident',
                 'Deviation', 'Change Control', 'Market Complaint']} />
    <DeptField form={form} setForm={setForm} required locked={isExisting} />
    <F {...p} label="Reason / Preliminary Investigation" name="description"
       multiline xs={12} />

    <Grid item xs={12}>
      <Alert severity="info" sx={{ mt: 1 }}>
        <strong>Initial Remedial Action + Preventive Action</strong> are
        filled by the HOD at <em>Proposed CAPA by HOD</em>. Site Head Required is set during the 2nd QA Evaluation pass. Closure must
        happen within <strong>30 days</strong>; Head QA selects the
        effectiveness-assessment frequency at closure.
      </Alert>
    </Grid>
  </>);
};

// ── Deviation ─────────────────────────────────────────────────────────────────
//
// Per Kedar-sir spec, every Deviation must originate from an existing
// Incident where the Incident HOD ticked "deviation_required = true" and
// QA confirmed it during evaluation. We surface a "Parent Incident" picker
// at the top of the dialog and pre-fill product/batch/process-area from
// the chosen Incident so the Initiator doesn't retype context.
//
// Fields moved later in the lifecycle (filled via the stage panels):
//   • Risk / Impact Assessment, CAPA Required, CAPA #     → PENDING_HOD
//   • Site Head Required / Customer Comment Required      → 2nd PENDING_QA_REVIEW
//   • Investigation Summary                                → PENDING_VERIFICATION
const useDeviationEligibleIncidents = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    // We pull all open Incidents and filter client-side by deviationRequired
    // — the search endpoint doesn't expose a flag-only filter today.
    getIncidentsApi({ size: 200, status: 'PENDING_QA_REVIEW' })
      .then(({ data }) => {
        const rows = (data?.data?.content || data?.data || []);
        setList(rows.filter(r => r?.deviationRequired === true));
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);
  return { list, loading };
};

const ParentIncidentPicker = ({ form, setForm }) => {
  const { list, loading } = useDeviationEligibleIncidents();
  return (
    <Grid item xs={12}>
      <TextField
        label="Parent Incident" select required fullWidth size="small"
        value={form.parentIncidentId || ''}
        onChange={(e) => {
          const id = e.target.value;
          const matched = list.find(i => String(i.id) === String(id));
          setForm(prev => ({
            ...prev,
            parentIncidentId: id || null,
            // Pre-fill from the chosen incident so the Initiator doesn't retype.
            productBatch: matched?.productBatch || matched?.batchNumber || prev.productBatch,
            processArea: matched?.processArea || matched?.location       || prev.processArea,
          }));
        }}
        helperText={loading
          ? 'Loading eligible Incidents…'
          : list.length === 0
            ? 'No Incidents are flagged as Deviation Required + at PENDING_QA_REVIEW. Ask the Incident QA Reviewer to confirm one first.'
            : 'Pick the Incident this Deviation is being raised against.'}
      >
        {loading && <MenuItem value=""><em>Loading…</em></MenuItem>}
        {list.map(i => (
          <MenuItem key={i.id} value={i.id}>
            {i.recordNumber} — {i.title}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );
};

export const CreateDeviationDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const initialForm = {
    title: '',
    parentIncidentId: null,
    deviationType: 'Unplanned',
    priority: 'MEDIUM',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    productBatch: '',
    processArea: '',
    description: '',
    regulatoryReportable: false,
  };

  return (
    <BaseDialog
      open={open} onClose={onClose} title="Report Deviation"
      initialForm={initialForm}
      onSubmit={async (form) => {
        if (!form.parentIncidentId) {
          throw new FormValidationError(
              'Parent Incident is required — every Deviation must descend from an Incident.');
        }
        await createDeviationApi(form);
        onCreated?.();
      }}
    >
      {({ form, setForm }) => {
        const p = { form, setForm };
        return (<>
          {!user?.departmentId && (
            <Grid item xs={12}>
              <Alert severity="warning">
                Your profile has no department assigned. Ask an admin to set
                your department on the Users page before raising a Deviation.
              </Alert>
            </Grid>
          )}

          <SectionLabel>Origin</SectionLabel>
          <ParentIncidentPicker form={form} setForm={setForm} />

          <SectionLabel>Basic Info</SectionLabel>
          <F {...p} label="Title" name="title" required xs={12} />
          <F {...p} label="Deviation Type" name="deviationType"
             options={['Planned', 'Unplanned', 'Temporary']} />
          <DeptField form={form} setForm={setForm} required locked />
          <F {...p} label="Product / Batch" name="productBatch" />
          <F {...p} label="Process Area" name="processArea" />
          <F {...p} label="Due Date" name="dueDate" type="date" />
          <SW {...p} label="Regulatory Reportable" name="regulatoryReportable" />
          <F {...p} label="Description" name="description" multiline xs={12} />

          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>Risk / Impact Assessment</strong> and <strong>CAPA Required + #</strong>
              {' '}are filled by the HOD at <em>HOD Assessment</em>. Priority,
              Site Head Required and Customer Comment Required are set by
              the QA Reviewer during the 2nd QA Evaluation.
              Closure must happen within <strong>30 days</strong> — beyond that, an
              approved target-date extension is required.
            </Alert>
          </Grid>
        </>);
      }}
    </BaseDialog>
  );
};

// ── Incident ──────────────────────────────────────────────────────────────────
//
// Per Kedar-sir spec, the sub-type chosen here drives one of FOUR end-to-end
// paths through the workflow graph. We capture the bare minimum at create
// time — the HOD's branching flags (Retesting Required / Deviation Required)
// and the QA Reviewer's Site Head Required flag are set on the stage panels
// where they're actually decided. A footnote explains the implications.
export const CreateIncidentDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const initialForm = {
    title: '',
    incidentType: 'Quality',
    incidentSubType: 'GENERAL',
    severity: 'Minor',
    priority: 'MEDIUM',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    location: '',
    occurrenceDate: '',
    reportedBy: '',
    immediateAction: '',
    description: '',
    injuryInvolved: false,
  };

  return (
    <BaseDialog
      open={open} onClose={onClose} title="Report Incident"
      initialForm={initialForm}
      onSubmit={async (form) => { await createIncidentApi(form); onCreated?.(); }}
    >
      {({ form, setForm }) => {
        const p = { form, setForm };
        return (<>
          {!user?.departmentId && (
            <Grid item xs={12}>
              <Alert severity="warning">
                Your profile has no department assigned. Ask an admin to set
                your department on the Users page before raising an Incident.
              </Alert>
            </Grid>
          )}

          <SectionLabel>Basic Info</SectionLabel>
          <F {...p} label="Title" name="title" required xs={12} />
          <F {...p} label="Sub-Type" name="incidentSubType" options={['LABORATORY', 'GENERAL']} />
          <F {...p} label="Incident Type" name="incidentType"
             options={['Safety', 'Quality', 'Environmental', 'Equipment', 'Personnel']} />
          <F {...p} label="Severity" name="severity" options={['Minor', 'Major', 'Critical']} />
          <F {...p} label="Priority" name="priority" options={PRIORITY_OPTS} />
          <DeptField form={form} setForm={setForm} required locked />
          <F {...p} label="Location" name="location" required />
          <F {...p} label="Occurrence Date" name="occurrenceDate" type="date" />
          <F {...p} label="Reported By" name="reportedBy" />
          <SW {...p} label="Injury Involved" name="injuryInvolved" />

          <SectionLabel>Details</SectionLabel>
          <F {...p} label="Immediate Action Taken" name="immediateAction" multiline xs={12} />
          <F {...p} label="Description" name="description" multiline xs={12} />

          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>Sub-Type drives the workflow:</strong>
              {' '}<em>LABORATORY</em> routes through QA → (optional Site Head) → Head QA →
              Attachments → Verification → Closed; the HOD picks Retesting Required
              at HOD Assessment.{' '}<em>GENERAL</em> goes through QA → Dept Comments → QA →
              (optional Site Head) → Head QA → Attachments → Verification → Closed,
              unless the HOD ticks Deviation Required — in which case the Incident
              terminates after QA confirmation and a fresh Deviation is spawned.
              {' '}<strong>Risk Assessment, CAPA flag/#, and Abnormality narrative</strong>
              {' '}are filled at HOD Assessment / Assessment by QA.
            </Alert>
          </Grid>
        </>);
      }}
    </BaseDialog>
  );
};

// ── Change Control ────────────────────────────────────────────────────────────
//
// Layout per May 2026 tester feedback. Strict field order, every field
// mandatory, save-confirm pop-up, no Description, no Proposed Date
// (auto-stamped to today), Reason renamed to Remark/Justification at the
// END of each line item.
//
//   1. Change Control Title
//   2. Department (locked from profile)
//   3. Date — today's date, read-only
//   4. Product / Material Name
//   5. Product / Material Code
//   6. Change Type
//   7. Line items: Existing System | Proposed System | Remark / Justification
//   8. Attachment (DMS document picker, optional)
//
// Everything beyond Create lives on the stage panels:
//   - HOD Assessment    → Initial Assessment (renamed from Risk Assessment)
//   - QA Evaluation Phase 1 → Change Control Type (= Risk Level), Pre-Remark,
//                              invite Departments
//   - QA Evaluation Phase 2 → QA Eval Remark, Risk Assessment Req/Not, Site
//                              Head Req, Customer Communication Req,
//                              Regulatory Assessment Req
const todayIso = () => new Date().toISOString().slice(0, 10);

export const CreateChangeControlDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();

  // DMS attachment picker state (lives outside the form so we can search-as-you-type)
  const [dmsQuery, setDmsQuery]     = useState('');
  const [dmsOptions, setDmsOptions] = useState([]);
  const [dmsLoading, setDmsLoading] = useState(false);

  // Save-confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Round-2 A2: guard the confirm-Yes button against rapid double-click
  // (same pattern as BaseDialog handleSave).
  const [confirmSaving, setConfirmSaving] = useState(false);
  const confirmInFlight = React.useRef(false);
  // Round-3 R3: e-sign before the record is created. The flow is:
  //   confirm "Yes, Save" → open e-sign → server verifies password → persist
  const [eSignOpen, setESignOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState(null);

  // Search DMS docs only while the dialog is open + the user is typing.
  useEffect(() => {
    if (!open) return;
    setDmsLoading(true);
    const handle = setTimeout(() => {
      getDocumentsApi({ search: dmsQuery, size: 25, status: 'EFFECTIVE' })
        .then(({ data }) => setDmsOptions(data?.data?.content || data?.data || []))
        .catch(() => setDmsOptions([]))
        .finally(() => setDmsLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [dmsQuery, open]);

  const initialForm = {
    title: '',
    productMaterial: '',
    productMaterialCode: '',
    changeType: '',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    // Priority is required by the backend's QmsBaseRequest validator —
    // default to MEDIUM at create time; QA Reviewer overrides at QA_REVIEW.
    priority: 'MEDIUM',
    initialAttachmentRef: '',                  // raw DMS id or free text
    _attachmentDoc: null,                      // selected DMS document object (UI-only)
    _localFile: null,                          // Round-2 A1 selected local file (UI-only)
    _localAttachmentRef: '',                   // Round-2 A1 server-assigned "QMS-ATT-{id}" after upload
    lineItems: [{ existingSystem: '', proposedSystem: '', justification: '' }],
  };

  /**
   * Validate every Create-time field and every line-item field. Returns a
   * human-readable error message on the first miss, or null when the form
   * is complete enough to save. Per tester feedback every field is
   * mandatory; blank line items are rejected.
   */
  const validateForm = (form) => {
    if (!form.title?.trim())               return 'Change Control Title is required.';
    if (!form.departmentId)                return 'Department is required.';
    if (!form.productMaterial?.trim())     return 'Product / Material Name is required.';
    if (!form.productMaterialCode?.trim()) return 'Product / Material Code is required.';
    if (!form.changeType?.trim())          return 'Change Type is required.';
    const rows = form.lineItems || [];
    if (rows.length === 0) return 'At least one line item is required.';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.existingSystem?.trim()) return `Line item #${i + 1}: Existing System is required.`;
      if (!row.proposedSystem?.trim()) return `Line item #${i + 1}: Proposed System is required.`;
      if (!row.justification?.trim())  return `Line item #${i + 1}: Remark / Justification is required.`;
    }
    return null;
  };

  /**
   * After the Change Control is saved, fire-and-forget the line-item POSTs.
   * Proposed Date is stamped to today's date for every row.
   */
  const persist = async (form) => {
    const today = todayIso();
    const {
      lineItems = [], _attachmentDoc, _localFile, _localAttachmentRef, ...payload
    } = form;
    // Round-2 A1: a local file takes precedence when supplied; otherwise we
    // fall back to the DMS picker. Both store on the same column slot.
    if (_localAttachmentRef) {
      payload.initialAttachmentRef = _localAttachmentRef;
    } else if (_attachmentDoc?.id) {
      payload.initialAttachmentRef = String(_attachmentDoc.id);
    }
    const { data } = await createChangeControlApi(payload);
    const created  = data?.data || data;
    const newId    = created?.id;
    if (newId && lineItems.length > 0) {
      await Promise.all(lineItems.map(li => createLineItemApi('change-control', newId, {
        existingSystem: li.existingSystem.trim(),
        proposedSystem: li.proposedSystem.trim(),
        justification:  li.justification.trim(),
        proposedDate:   today,
      }).catch(() => null)));
    }
    onCreated?.();
  };

  // Two-step submit: validate → confirm pop-up → persist
  const handleSubmitRequest = async (form) => {
    const err = validateForm(form);
    if (err) throw new FormValidationError(err);
    // Stash the form; open the confirm dialog. The actual persist runs in
    // handleConfirmYes below — at which point we close BOTH dialogs.
    setPendingForm(form);
    setConfirmOpen(true);
    // Keep BaseDialog open — the confirm-pop-up sits on top of it.
    // Throw a no-op to prevent BaseDialog from closing itself prematurely.
    throw new FormValidationError('__pending_confirm__');
  };

  const handleConfirmYes = () => {
    if (!pendingForm) return;
    // Round-3 R3: instead of persisting immediately, open the e-sign dialog.
    // The actual persist runs inside handleESignedSave once the server
    // verifies the user's password.
    setConfirmOpen(false);
    setESignOpen(true);
  };

  const handleESignedSave = async () => {
    if (!pendingForm) return;
    if (confirmInFlight.current) return; // double-click guard
    confirmInFlight.current = true;
    setConfirmSaving(true);
    try {
      await persist(pendingForm);
      setESignOpen(false);
      setPendingForm(null);
      onClose();
    } catch (err) {
      setESignOpen(false);
      throw err;
    } finally {
      setConfirmSaving(false);
      setTimeout(() => { confirmInFlight.current = false; }, 300);
    }
  };

  return (
    <>
      <BaseDialog
        open={open} onClose={onClose} title="Initiate Change Control"
        skipESign={/* CC has its own confirm + e-sign sequence below */ true}
        initialForm={initialForm}
        onSubmit={async (form) => {
          try {
            await handleSubmitRequest(form);
          } catch (err) {
            // Suppress the internal "__pending_confirm__" sentinel; let real
            // validation errors bubble so BaseDialog renders them in its
            // Alert banner.
            if (err?.response?.data?.message === '__pending_confirm__') return;
            throw err;
          }
        }}
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

            <SectionLabel>Initiation of Change</SectionLabel>

            {/* 1. Change Control Title */}
            <F {...p} label="Change Control Title" name="title" required xs={12} />

            {/* 2. Department (locked) */}
            <DeptField form={form} setForm={setForm} required locked />

            {/* 3. Date (today, locked) */}
            <Grid item xs={6}>
              <TextField
                label="Date" type="date" fullWidth size="small"
                value={todayIso()} disabled
                InputLabelProps={{ shrink: true }}
                helperText="Today's date — locked."
              />
            </Grid>

            {/* 4 + 5. Product / Material Name + Code */}
            <F {...p} label="Product / Material Name" name="productMaterial" required xs={6} />
            <F {...p} label="Product / Material Code" name="productMaterialCode" required xs={6} />

            {/* 6. Change Type */}
            <F {...p} label="Change Type" name="changeType" required xs={6}
               options={['', 'Process', 'Equipment', 'Document', 'System', 'Supplier', 'Facility']} />

            {/* 7. Line items: Existing | Proposed | Remark/Justification */}
            <SectionLabel>Line Items</SectionLabel>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Add one row per change line. Every field is mandatory — blank rows are rejected.
                Proposed Date is auto-stamped to today on save.
              </Typography>
              {(form.lineItems || []).map((li, idx) => (
                <Box key={idx} sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1.2fr 40px',
                    gap: 1, mb: 1, alignItems: 'flex-start',
                  }}>
                  <TextField
                    label={`Existing System ${idx + 1}`} size="small" multiline minRows={1} required
                    value={li.existingSystem || ''}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], existingSystem: e.target.value };
                      setForm(prev => ({ ...prev, lineItems: next }));
                    }}
                  />
                  <TextField
                    label={`Proposed System ${idx + 1}`} size="small" multiline minRows={1} required
                    value={li.proposedSystem || ''}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], proposedSystem: e.target.value };
                      setForm(prev => ({ ...prev, lineItems: next }));
                    }}
                  />
                  <TextField
                    label={`Remark / Justification ${idx + 1}`} size="small" multiline minRows={1} required
                    value={li.justification || ''}
                    onChange={(e) => {
                      const next = [...form.lineItems];
                      next[idx] = { ...next[idx], justification: e.target.value };
                      setForm(prev => ({ ...prev, lineItems: next }));
                    }}
                    placeholder="Why is this line being changed?"
                  />
                  <Tooltip title="Remove line">
                    <span>
                      <IconButton
                        size="small"
                        disabled={(form.lineItems || []).length <= 1}
                        onClick={() => {
                          const next = (form.lineItems || []).filter((_, i) => i !== idx);
                          setForm(prev => ({
                            ...prev,
                            lineItems: next.length ? next
                              : [{ existingSystem: '', proposedSystem: '', justification: '' }],
                          }));
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
                onClick={() => {
                  // Reject "Add line" while the current last row is blank
                  // — prevents the user from piling up empty rows.
                  const rows = form.lineItems || [];
                  const last = rows[rows.length - 1];
                  if (last && (!last.existingSystem?.trim() || !last.proposedSystem?.trim()
                               || !last.justification?.trim())) {
                    return;
                  }
                  setForm(prev => ({
                    ...prev,
                    lineItems: [...rows, { existingSystem: '', proposedSystem: '', justification: '' }],
                  }));
                }}
              >
                Add line
              </Button>
            </Grid>

            {/* 8. Attachment (optional) — two paths:
                  ① DMS picker for controlled documents already in DMS
                  ② Browse for a local file (Word, PDF, JPG) for ad-hoc evidence.
                Round-2 A1: Browse upload added. The two paths are
                mutually exclusive — picking one clears the other. */}
            <SectionLabel>Attachment (optional)</SectionLabel>
            <Grid item xs={12} md={8}>
              <Autocomplete
                size="small" fullWidth
                options={dmsOptions}
                loading={dmsLoading}
                value={form._attachmentDoc || null}
                disabled={!!form._localFile}
                getOptionLabel={(o) => o ? `${o.docNumber} v${o.version || '?'} — ${o.title}` : ''}
                isOptionEqualToValue={(a, b) => a?.id === b?.id}
                onInputChange={(_, val) => setDmsQuery(val)}
                onChange={(_, val) => setForm(prev => ({ ...prev, _attachmentDoc: val }))}
                renderInput={(params) => (
                  <TextField {...params} label="DMS Document" placeholder="Search by number or title…"
                             helperText={form._localFile
                                ? 'A local file is selected — remove it to pick a DMS document.'
                                : 'Pick from DMS — title and version resolve automatically.'} />
                )}
              />
            </Grid>
            {/* Round-2 A1 — Local file uploader */}
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  component="label"
                  disabled={!!form._attachmentDoc || form._uploadingFile}
                  fullWidth
                >
                  {form._uploadingFile ? 'Uploading…' : 'Browse local file'}
                  <input
                    type="file"
                    hidden
                    accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.gif,.bmp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = ''; // allow re-pick of same file
                      if (!f) return;
                      if (f.size > 10 * 1024 * 1024) {
                        alert('File is larger than 10 MB. Check it into DMS first and reference the document id instead.');
                        return;
                      }
                      setForm(prev => ({ ...prev, _localFile: f, _uploadingFile: true }));
                      try {
                        const { data } = await uploadRecordAttachmentApi(f);
                        const ref = data?.data?.attachmentRef || data?.attachmentRef;
                        setForm(prev => ({
                          ...prev,
                          _localAttachmentRef: ref || '',
                          _uploadingFile: false,
                          _attachmentDoc: null,
                        }));
                      } catch (err) {
                        const msg = err?.response?.data?.message || 'Upload failed.';
                        alert(msg);
                        setForm(prev => ({
                          ...prev, _localFile: null, _localAttachmentRef: '',
                          _uploadingFile: false,
                        }));
                      }
                    }}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Word, PDF, or JPG up to 10 MB.
                </Typography>
              </Box>
            </Grid>
            {form._localFile && (
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip icon={<AttachFileIcon />} size="small" color="primary"
                        label={`${form._localFile.name} · ${(form._localFile.size / 1024).toFixed(0)} KB`} />
                  <Tooltip title="Remove this file">
                    <IconButton size="small"
                                onClick={() => setForm(prev => ({
                                  ...prev, _localFile: null, _localAttachmentRef: '',
                                }))}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            )}

            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 1 }}>
                After save you&apos;ll receive a CC number. <strong>Initial Assessment</strong> is
                filled by the HOD at <em>HOD Assessment</em>. <strong>Change Control Type</strong> +
                <strong> Pre-Remark</strong> and the department fan-out are set by the QA Reviewer
                during QA Evaluation Phase 1.
              </Alert>
            </Grid>
          </>);
        }}
      </BaseDialog>

      {/* Save confirmation pop-up — appears on top of the Create dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Change Control?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Do you want to save this Change Control as a Draft? A CC number will be
            generated. You can still edit the draft from the detail drawer before submitting.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={confirmSaving}>No</Button>
          <Button variant="contained" onClick={handleConfirmYes} disabled={confirmSaving}>
            Yes, Sign &amp; Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Round-3 R3 — e-sign before the CC draft is persisted. */}
      <ESignDialog
        open={eSignOpen}
        onClose={() => !confirmSaving && setESignOpen(false)}
        onSigned={handleESignedSave}
        meaning="Create Change Control draft"
        actionLabel={confirmSaving ? 'Saving…' : 'Sign & create draft'}
      />
    </>
  );
};

// ── Market Complaint ──────────────────────────────────────────────────────────
//
// Per Kedar-sir spec (May 2026):
//
//  Initiation (Create dialog — this file)
//    • Existing vs New Market Complaint mode (links to a parent MC if Existing)
//    • Subject (Product / Packing / Transportation / Labels / Drum / Shipper /
//      Carton / Bag), Source, Customer, Product, Reason / Description, etc.
//
//  Pending HOD review (stage panel)
//    • HOD adds a review comment only — no department routing here.
//
//  PENDING_INVESTIGATION (QA hub — stage panel)
//    • Impact Assessment + Investigation Findings
//    • CAPA Required (+ CAPA #)
//    • Optionally invites departments via the dept-comments accordion below
//
//  PENDING_DEPT_COMMENT (loop)
//    • Each invited dept HOD fills their feedback. Loops back to QA.
//
//  PENDING_HEAD_QA + CLOSED
//    • Head QA verifies + closes. Close is gated by the 45-day SLA on the
//      backend; an approved target-date extension is required to close late.
const COMPLAINT_SUBJECTS = [
  'Product', 'Packing', 'Transportation', 'Labels',
  'Drum', 'Shipper', 'Carton', 'Bag',
];
const COMPLAINT_SOURCES = [
  'Customer', 'Vendor', 'Client', 'Retailer', 'Distributor',
  'Email', 'Phone', 'Portal', 'Field Visit', 'Letter',
];

export const CreateComplaintDialog = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const initialForm = {
    title: '',
    complaintOrigin: 'NEW',
    parentComplaintId: null,
    complaintSubject: 'Product',
    complaintCategory: 'Quality',
    complaintSource: 'Customer',
    priority: 'MEDIUM',
    departmentId: user?.departmentId ?? null,
    department:   user?.departmentName || user?.department || '',
    customerName: '',
    customerCountry: '',
    productName: '',
    batchNumber: '',
    receivedDate: '',
    reportableToAuthority: false,
    sampleReturned: false,
    description: '',
  };

  return (
    <BaseDialog
      open={open} onClose={onClose} title="Log Market Complaint"
      initialForm={initialForm}
      onSubmit={async (form) => { await createComplaintApi(form); onCreated?.(); }}
    >
      {({ form, setForm }) => {
        const p = { form, setForm };
        const isExisting = form.complaintOrigin === 'EXISTING';
        return (<>
          <SectionLabel>Complaint Type</SectionLabel>
          <F {...p} label="Complaint Origin" name="complaintOrigin"
             options={['NEW', 'EXISTING']} xs={6} />
          {isExisting && (
            <F {...p} label="Parent MC Number" name="parentComplaintId"
               xs={6} shrinkLabel />
          )}

          <SectionLabel>Complaint Details</SectionLabel>
          <F {...p} label="Complaint Title" name="title" required xs={12} />
          <F {...p} label="Subject" name="complaintSubject" options={COMPLAINT_SUBJECTS} />
          <F {...p} label="Source" name="complaintSource" options={COMPLAINT_SOURCES} />
          <F {...p} label="Category" name="complaintCategory"
             options={['Quality', 'Safety', 'Packaging', 'Labeling', 'Delivery', 'Service']} />
          <DeptField form={form} setForm={setForm} required locked />
          <F {...p} label="Received Date" name="receivedDate" type="date" />

          <SectionLabel>Customer &amp; Product</SectionLabel>
          <F {...p} label="Customer / Vendor / Client Name" name="customerName" required />
          <F {...p} label="Country" name="customerCountry" />
          <F {...p} label="Product Name" name="productName" />
          <F {...p} label="Batch Number" name="batchNumber" />
          <SW {...p} label="Reportable to Authority" name="reportableToAuthority" />
          <SW {...p} label="Sample Returned" name="sampleReturned" />

          <SectionLabel>Reason / Description</SectionLabel>
          <F {...p} label="Detailed reason for the complaint"
             name="description" multiline xs={12} />

          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 1 }}>
              Attach photos and supporting documents from the detail drawer
              after creating. <strong>Priority is set by Head QA</strong>;
              <strong> Investigation findings, Impact Assessment and CAPA flag</strong>
              {' '}are filled by QA Reviewer at QA Investigation.
              Closure must happen within <strong>45 days</strong> — beyond that,
              an approved target-date extension is required.
            </Alert>
          </Grid>
        </>);
      }}
    </BaseDialog>
  );
};
