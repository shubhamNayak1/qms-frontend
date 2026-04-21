import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';
import {
  getCapasApi, createCapaApi,
  getDeviationsApi, createDeviationApi,
  getIncidentsApi, createIncidentApi,
  getComplaintsApi, createComplaintApi,
  getChangeControlsApi, createChangeControlApi,
  getQmsDashboardApi,
} from '../../api/qmsApi';

const SEVERITY_COLORS = { CRITICAL: 'error', MAJOR: 'warning', MODERATE: 'warning', MINOR: 'info', LOW: 'info', MEDIUM: 'warning', HIGH: 'error', OBSERVATION: 'default' };
const IMPACT_COLORS = { HIGH: 'error', MEDIUM: 'warning', LOW: 'success' };

const TABS = [
  { label: 'CAPA', key: 'capa' },
  { label: 'Deviation', key: 'deviation' },
  { label: 'Incident', key: 'incident' },
  { label: 'Market Complaint', key: 'marketComplaint' },
  { label: 'Change Control', key: 'changeControl' },
];

const DIALOG_CONFIG = {
  capa: {
    title: 'Create CAPA',
    fields: [
      { label: 'Title', key: 'title', required: true },
      { label: 'Type', key: 'capaType', type: 'select', options: ['Corrective', 'Preventive'] },
      { label: 'Linked NC / Ref', key: 'linkedDeviationNumber' },
      { label: 'Priority', key: 'priority', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      { label: 'Target Date', key: 'targetCompletionDate', type: 'date' },
      { label: 'Description / Action Plan', key: 'description', multiline: true },
    ],
  },
  deviation: {
    title: 'Report Deviation',
    fields: [
      { label: 'Title', key: 'title', required: true },
      { label: 'Deviation Type', key: 'deviationType', type: 'select', options: ['PLANNED', 'UNPLANNED'] },
      { label: 'Department', key: 'department', type: 'select', options: ['Production', 'Warehouse', 'Packaging', 'Quality', 'Lab'] },
      { label: 'Priority', key: 'priority', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      { label: 'Product/Batch', key: 'productBatch' },
      { label: 'Description', key: 'description', multiline: true },
    ],
  },
  incident: {
    title: 'Report Incident',
    fields: [
      { label: 'Title', key: 'title', required: true },
      { label: 'Incident Type', key: 'incidentType', type: 'select', options: ['Safety', 'Environmental', 'Equipment', 'Near Miss', 'Quality'] },
      { label: 'Severity', key: 'severity', type: 'select', options: ['CRITICAL', 'MAJOR', 'MODERATE', 'MINOR'] },
      { label: 'Occurrence Date', key: 'occurrenceDate', type: 'date' },
      { label: 'Location', key: 'location', required: true },
      { label: 'Injury Involved', key: 'injuryInvolvedStr', type: 'select', options: ['Yes', 'No'] },
      { label: 'Description', key: 'description', multiline: true },
    ],
  },
  marketComplaint: {
    title: 'Log Market Complaint',
    fields: [
      { label: 'Complaint Title', key: 'title', required: true },
      { label: 'Customer Name', key: 'customerName', required: true },
      { label: 'Product Name', key: 'productName', required: true },
      { label: 'Batch Number', key: 'batchNumber' },
      { label: 'Country', key: 'customerCountry' },
      { label: 'Priority', key: 'priority', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      { label: 'Description', key: 'description', multiline: true },
    ],
  },
  changeControl: {
    title: 'Initiate Change Control',
    fields: [
      { label: 'Change Title', key: 'title', required: true },
      { label: 'Change Type', key: 'changeType', type: 'select', options: ['Supplier', 'Documentation', 'Equipment', 'Process', 'Material', 'System'] },
      { label: 'Risk Level', key: 'riskLevel', type: 'select', options: ['HIGH', 'MEDIUM', 'LOW'] },
      { label: 'Priority', key: 'priority', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      { label: 'Implementation Date', key: 'implementationDate', type: 'date' },
      { label: 'Reason for Change', key: 'description', multiline: true },
    ],
  },
};

const resolveAssignedTo = (r) =>
  r.assignedTo?.fullName || r.assignedTo?.name || r.assignedTo || '-';

const normCapa = (r) => ({
  id: r.id,
  refNumber: r.capaNumber || r.referenceNumber || `CAPA-${r.id}`,
  title: r.title,
  type: r.capaType || r.type || '-',
  linkedNc: r.linkedDeviationNumber || '-',
  assignedTo: resolveAssignedTo(r),
  status: r.status,
  targetDate: r.targetCompletionDate || r.dueDate,
  verifiedDate: r.verifiedDate || null,
});

const normDeviation = (r) => ({
  id: r.id,
  refNumber: r.deviationNumber || r.referenceNumber || `DEV-${r.id}`,
  title: r.title,
  department: r.department || '-',
  severity: r.severity || r.priority || 'MINOR',
  impact: r.impactAssessment || r.impact || '-',
  status: r.status,
  reportedBy: r.reportedBy || '-',
  reportedDate: r.reportedDate || r.createdAt,
});

const normIncident = (r) => ({
  id: r.id,
  refNumber: r.incidentNumber || r.referenceNumber || `INC-${r.id}`,
  title: r.title,
  type: r.incidentType || r.type || '-',
  severity: r.severity || r.priority || 'MINOR',
  status: r.status,
  reportedBy: r.reportedBy || '-',
  incidentDate: r.occurrenceDate || r.incidentDate || r.createdAt,
  injuryOccurred: r.injuryInvolved === true ? 'Yes' : r.injuryInvolved === false ? 'No' : (r.injuryOccurred || '-'),
});

const normComplaint = (r) => ({
  id: r.id,
  refNumber: r.complaintNumber || r.referenceNumber || `MC-${r.id}`,
  title: r.title,
  customer: r.customerName || r.customer || '-',
  productCode: r.productName || r.batchNumber || r.productCode || '-',
  country: r.customerCountry || r.country || '-',
  severity: r.severity || r.priority || 'MINOR',
  status: r.status,
  receivedDate: r.receivedDate || r.createdAt,
});

const normChangeControl = (r) => ({
  id: r.id,
  refNumber: r.ccNumber || r.changeControlNumber || r.referenceNumber || `CC-${r.id}`,
  title: r.title,
  category: r.changeType || r.category || '-',
  impact: r.riskLevel || r.impact || '-',
  initiatedBy: resolveAssignedTo(r),
  status: r.status,
  effectiveDate: r.implementationDate || r.effectiveDate || null,
});

const extractList = (data) => {
  const payload = data?.data;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.content ?? [];
};

// ── FormDialog ────────────────────────────────────────────────────────────
const FormDialog = ({ open, onClose, config, onSave }) => {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm({}); setErrors({}); }
  }, [open]);

  const validate = () => {
    const errs = {};
    config.fields.filter((f) => f.required).forEach((f) => {
      if (!form[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
    });
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{config?.title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {config?.fields.map((field) => (
            <Grid item xs={field.multiline ? 12 : 6} key={field.key}>
              {field.type === 'select' ? (
                <TextField
                  label={field.label}
                  select fullWidth size="small"
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  error={!!errors[field.key]}
                  helperText={errors[field.key]}
                >
                  {field.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              ) : (
                <TextField
                  label={field.label}
                  fullWidth size="small"
                  type={field.type || 'text'}
                  multiline={field.multiline}
                  rows={field.multiline ? 3 : 1}
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  error={!!errors[field.key]}
                  helperText={errors[field.key]}
                  InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const QmsPage = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [capaRows, setCapaRows] = useState([]);
  const [deviationRows, setDeviationRows] = useState([]);
  const [incidentRows, setIncidentRows] = useState([]);
  const [marketRows, setMarketRows] = useState([]);
  const [changeRows, setChangeRows] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { search: search || undefined, page: 0, size: 50 };
    try {
      const [capaRes, devRes, incRes, mcRes, ccRes] = await Promise.allSettled([
        getCapasApi(params),
        getDeviationsApi(params),
        getIncidentsApi(params),
        getComplaintsApi(params),
        getChangeControlsApi(params),
      ]);
      if (capaRes.status === 'fulfilled') setCapaRows(extractList(capaRes.value.data).map(normCapa));
      if (devRes.status === 'fulfilled') setDeviationRows(extractList(devRes.value.data).map(normDeviation));
      if (incRes.status === 'fulfilled') setIncidentRows(extractList(incRes.value.data).map(normIncident));
      if (mcRes.status === 'fulfilled') setMarketRows(extractList(mcRes.value.data).map(normComplaint));
      if (ccRes.status === 'fulfilled') setChangeRows(extractList(ccRes.value.data).map(normChangeControl));

      const dashRes = await getQmsDashboardApi().catch(() => null);
      if (dashRes) setDashboard(dashRes.data?.data || null);
    } catch {
      setError('Failed to load QMS data.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentTabKey = TABS[tab].key;
  const dialogConfig = DIALOG_CONFIG[currentTabKey];

  const CREATE_API = {
    capa: (form) => createCapaApi({ ...form, priority: form.priority || 'MEDIUM' }),
    deviation: (form) => createDeviationApi({ ...form, priority: form.priority || 'MEDIUM' }),
    incident: (form) => createIncidentApi({ ...form, injuryInvolved: form.injuryInvolvedStr === 'Yes', priority: form.severity || 'MEDIUM' }),
    marketComplaint: (form) => createComplaintApi({ ...form, priority: form.priority || 'MEDIUM' }),
    changeControl: (form) => createChangeControlApi({ ...form, priority: form.priority || 'MEDIUM' }),
  };

  const handleSave = async (form) => {
    await CREATE_API[currentTabKey](form);
    fetchData();
  };

  const capaColumns = [
    { field: 'refNumber', headerName: 'CAPA Number', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 230 },
    { field: 'type', headerName: 'Type', minWidth: 110, renderCell: (r) => <Chip label={r.type} size="small" color={r.type === 'Corrective' ? 'warning' : 'info'} /> },
    { field: 'linkedNc', headerName: 'Linked NC', minWidth: 120 },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 130 },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (r) => <Chip label={r.status?.replace(/_/g, ' ')} size="small" color={getStatusColor(r.status)} /> },
    { field: 'targetDate', headerName: 'Target Date', minWidth: 110, renderCell: (r) => formatDate(r.targetDate) },
  ];

  const deviationColumns = [
    { field: 'refNumber', headerName: 'DEV Number', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 230 },
    { field: 'department', headerName: 'Department', minWidth: 120 },
    { field: 'severity', headerName: 'Severity', minWidth: 100, renderCell: (r) => <Chip label={r.severity} size="small" color={SEVERITY_COLORS[r.severity] || 'default'} /> },
    { field: 'impact', headerName: 'Impact', minWidth: 120 },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (r) => <Chip label={r.status?.replace(/_/g, ' ')} size="small" color={getStatusColor(r.status)} /> },
    { field: 'reportedDate', headerName: 'Reported', minWidth: 110, renderCell: (r) => formatDate(r.reportedDate) },
  ];

  const incidentColumns = [
    { field: 'refNumber', headerName: 'INC Number', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 230 },
    { field: 'type', headerName: 'Type', minWidth: 110, renderCell: (r) => <Chip label={r.type} size="small" variant="outlined" /> },
    { field: 'severity', headerName: 'Severity', minWidth: 100, renderCell: (r) => <Chip label={r.severity} size="small" color={SEVERITY_COLORS[r.severity] || 'default'} /> },
    { field: 'injuryOccurred', headerName: 'Injury', minWidth: 80, renderCell: (r) => <Chip label={r.injuryOccurred} size="small" color={r.injuryOccurred === 'Yes' ? 'error' : 'success'} /> },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (r) => <Chip label={r.status?.replace(/_/g, ' ')} size="small" color={getStatusColor(r.status)} /> },
    { field: 'incidentDate', headerName: 'Date', minWidth: 110, renderCell: (r) => formatDate(r.incidentDate) },
  ];

  const marketColumns = [
    { field: 'refNumber', headerName: 'MC Number', minWidth: 130 },
    { field: 'title', headerName: 'Complaint', minWidth: 220 },
    { field: 'customer', headerName: 'Customer', minWidth: 140 },
    { field: 'productCode', headerName: 'Product', minWidth: 110 },
    { field: 'country', headerName: 'Country', minWidth: 90 },
    { field: 'severity', headerName: 'Severity', minWidth: 100, renderCell: (r) => <Chip label={r.severity} size="small" color={SEVERITY_COLORS[r.severity] || 'default'} /> },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (r) => <Chip label={r.status?.replace(/_/g, ' ')} size="small" color={getStatusColor(r.status)} /> },
    { field: 'receivedDate', headerName: 'Received', minWidth: 110, renderCell: (r) => formatDate(r.receivedDate) },
  ];

  const changeColumns = [
    { field: 'refNumber', headerName: 'CC Number', minWidth: 130 },
    { field: 'title', headerName: 'Change Title', minWidth: 230 },
    { field: 'category', headerName: 'Type', minWidth: 120 },
    { field: 'impact', headerName: 'Risk', minWidth: 90, renderCell: (r) => <Chip label={r.impact} size="small" color={IMPACT_COLORS[r.impact] || 'default'} /> },
    { field: 'initiatedBy', headerName: 'Initiated By', minWidth: 130 },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (r) => <Chip label={r.status?.replace(/_/g, ' ')} size="small" color={getStatusColor(r.status)} /> },
    { field: 'effectiveDate', headerName: 'Effective Date', minWidth: 120, renderCell: (r) => formatDate(r.effectiveDate) },
  ];

  const tabData = {
    capa: { rows: capaRows, columns: capaColumns },
    deviation: { rows: deviationRows, columns: deviationColumns },
    incident: { rows: incidentRows, columns: incidentColumns },
    marketComplaint: { rows: marketRows, columns: marketColumns },
    changeControl: { rows: changeRows, columns: changeColumns },
  };

  const ADD_BUTTON_LABELS = {
    capa: 'Create CAPA',
    deviation: 'Report Deviation',
    incident: 'Report Incident',
    marketComplaint: 'Log Complaint',
    changeControl: 'Initiate Change',
  };

  const d = dashboard;
  const summaryCards = [
    { label: 'Open CAPAs', value: d?.openCapaCount ?? capaRows.filter((r) => r.status === 'OPEN').length, color: 'warning.main' },
    { label: 'Open Deviations', value: d?.openDeviationCount ?? deviationRows.filter((r) => r.status === 'OPEN').length, color: 'info.main' },
    { label: 'Open Incidents', value: d?.openIncidentCount ?? incidentRows.filter((r) => r.status === 'OPEN').length, color: 'secondary.main' },
    { label: 'Market Complaints', value: d?.openComplaintCount ?? marketRows.filter((r) => r.status !== 'CLOSED').length, color: 'error.main' },
    { label: 'Pending Changes', value: d?.pendingChangeCount ?? changeRows.filter((r) => ['PENDING', 'DRAFT'].includes(r.status)).length, color: 'warning.main' },
  ];

  return (
    <Box>
      <PageHeader
        title="Quality Management System"
        subtitle="CAPA · Deviation · Incident · Market Complaint · Change Control"
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'QMS' }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {ADD_BUTTON_LABELS[currentTabKey]}
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map(({ label, value, color }) => (
          <Grid item xs={6} sm={4} lg={2} key={label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2, px: 1 }}>
                <Typography variant="h4" fontWeight={700} color={color}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField
          placeholder="Search..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Tooltip title="Refresh"><IconButton onClick={fetchData}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      <DataTable
        columns={tabData[currentTabKey].columns}
        rows={tabData[currentTabKey].rows}
        loading={loading}
        totalCount={tabData[currentTabKey].rows.length}
      />

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        config={dialogConfig}
        onSave={handleSave}
      />
    </Box>
  );
};

export default QmsPage;
