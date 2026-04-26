import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';
import {
  getCapasApi, getDeviationsApi, getIncidentsApi,
  getComplaintsApi, getChangeControlsApi, getQmsDashboardApi,
} from '../../api/qmsApi';
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, MODULE_META,
} from './qmsConstants';
import RecordDetailDrawer from './RecordDetailDrawer';
import {
  CreateCapaDialog, CreateDeviationDialog, CreateIncidentDialog,
  CreateChangeControlDialog, CreateComplaintDialog,
} from './CreateRecordDialogs';

// ── Shared status chip ────────────────────────────────────────────────────────
const StatusChip = ({ status }) => (
  <Chip
    label={STATUS_LABELS[status] || status?.replace(/_/g, ' ') || '—'}
    size="small"
    color={STATUS_COLORS[status] || 'default'}
  />
);

const PriorityChip = ({ priority }) => (
  <Chip label={priority || '—'} size="small" color={PRIORITY_COLORS[priority] || 'default'} variant="outlined" />
);

// ── Row normalizers ───────────────────────────────────────────────────────────
const refNum = (r, prefix) =>
  r.recordNumber || r.capaNumber || r.deviationNumber ||
  r.incidentNumber || r.complaintNumber || r.ccNumber ||
  `${prefix}-${r.id}`;

const normCapa = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'CAPA'),
  title: r.title,
  capaType: r.capaType || '—',
  source: r.source || '—',
  department: r.department || '—',
  assignedTo: r.assignedToName || '—',
  priority: r.priority,
  status: r.status,
  dueDate: r.dueDate,
  overdue: r.overdue,
});
const normDeviation = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'DEV'),
  title: r.title,
  deviationType: r.deviationType || '—',
  department: r.department || '—',
  productBatch: r.productBatch || '—',
  priority: r.priority,
  status: r.status,
  createdAt: r.createdAt,
  overdue: r.overdue,
});
const normIncident = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'INC'),
  title: r.title,
  incidentType: r.incidentType || '—',
  incidentSubType: r.incidentSubType || '—',
  severity: r.severity || r.priority,
  priority: r.priority,
  status: r.status,
  occurrenceDate: r.occurrenceDate || r.createdAt,
  overdue: r.overdue,
});
const normComplaint = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'MC'),
  title: r.title,
  customerName: r.customerName || '—',
  productName: r.productName || '—',
  complaintCategory: r.complaintCategory || '—',
  priority: r.priority,
  status: r.status,
  receivedDate: r.receivedDate || r.createdAt,
  overdue: r.overdue,
});
const normChangeControl = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'CC'),
  title: r.title,
  changeType: r.changeType || '—',
  riskLevel: r.riskLevel || '—',
  priority: r.priority,
  status: r.status,
  implementationDate: r.implementationDate,
  overdue: r.overdue,
});

const extractList = (data) => {
  const payload = data?.data;
  if (!payload) return [];
  return Array.isArray(payload) ? payload : (payload.content ?? []);
};

// ── Columns per module ────────────────────────────────────────────────────────
const makeColumns = (openDetail) => ({
  capa: [
    { field: 'refNumber',   headerName: 'CAPA #',      minWidth: 140 },
    { field: 'title',       headerName: 'Title',        minWidth: 220 },
    { field: 'capaType',    headerName: 'Type',         minWidth: 110 },
    { field: 'source',      headerName: 'Source',       minWidth: 100 },
    { field: 'department',  headerName: 'Dept',         minWidth: 100 },
    { field: 'priority',    headerName: 'Priority',     minWidth: 100, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',      headerName: 'Status',       minWidth: 150, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'dueDate',     headerName: 'Due',          minWidth: 100, renderCell: (r) => formatDate(r.dueDate) },
    { field: 'actions',     headerName: '',             minWidth: 60,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  deviation: [
    { field: 'refNumber',     headerName: 'DEV #',       minWidth: 140 },
    { field: 'title',         headerName: 'Title',        minWidth: 220 },
    { field: 'deviationType', headerName: 'Type',         minWidth: 110 },
    { field: 'department',    headerName: 'Dept',         minWidth: 100 },
    { field: 'productBatch',  headerName: 'Batch',        minWidth: 110 },
    { field: 'priority',      headerName: 'Priority',     minWidth: 100, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',        headerName: 'Status',       minWidth: 150, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'createdAt',     headerName: 'Reported',     minWidth: 100, renderCell: (r) => formatDate(r.createdAt) },
    { field: 'actions',       headerName: '',             minWidth: 60,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  incident: [
    { field: 'refNumber',      headerName: 'INC #',        minWidth: 140 },
    { field: 'title',          headerName: 'Title',         minWidth: 220 },
    { field: 'incidentType',   headerName: 'Type',          minWidth: 110 },
    { field: 'incidentSubType',headerName: 'Sub-Type',      minWidth: 100 },
    { field: 'severity',       headerName: 'Severity',      minWidth: 90,  renderCell: (r) => <Chip label={r.severity || '—'} size="small" color={PRIORITY_COLORS[r.severity?.toUpperCase()] || 'default'} variant="outlined" /> },
    { field: 'priority',       headerName: 'Priority',      minWidth: 100, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',         headerName: 'Status',        minWidth: 150, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'occurrenceDate', headerName: 'Date',          minWidth: 100, renderCell: (r) => formatDate(r.occurrenceDate) },
    { field: 'actions',        headerName: '',              minWidth: 60,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  marketComplaint: [
    { field: 'refNumber',        headerName: 'MC #',          minWidth: 140 },
    { field: 'title',            headerName: 'Complaint',      minWidth: 200 },
    { field: 'customerName',     headerName: 'Customer',       minWidth: 130 },
    { field: 'productName',      headerName: 'Product',        minWidth: 120 },
    { field: 'complaintCategory',headerName: 'Category',       minWidth: 110 },
    { field: 'priority',         headerName: 'Priority',       minWidth: 100, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',           headerName: 'Status',         minWidth: 150, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'receivedDate',     headerName: 'Received',       minWidth: 100, renderCell: (r) => formatDate(r.receivedDate) },
    { field: 'actions',          headerName: '',               minWidth: 60,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  changeControl: [
    { field: 'refNumber',        headerName: 'CC #',           minWidth: 140 },
    { field: 'title',            headerName: 'Change Title',    minWidth: 200 },
    { field: 'changeType',       headerName: 'Type',            minWidth: 110 },
    { field: 'riskLevel',        headerName: 'Risk',            minWidth: 90,  renderCell: (r) => <Chip label={r.riskLevel} size="small" color={r.riskLevel === 'High' ? 'error' : r.riskLevel === 'Medium' ? 'warning' : 'success'} variant="outlined" /> },
    { field: 'priority',         headerName: 'Priority',        minWidth: 100, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',           headerName: 'Status',          minWidth: 150, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'implementationDate', headerName: 'Impl. Date',    minWidth: 110, renderCell: (r) => formatDate(r.implementationDate) },
    { field: 'actions',          headerName: '',                minWidth: 60,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
});

const TABS = [
  { label: 'CAPA',            key: 'capa' },
  { label: 'Deviation',       key: 'deviation' },
  { label: 'Incident',        key: 'incident' },
  { label: 'Market Complaint',key: 'marketComplaint' },
  { label: 'Change Control',  key: 'changeControl' },
];

const STATUS_FILTER_OPTS = [
  '', 'DRAFT', 'PENDING_HOD', 'PENDING_QA_REVIEW', 'PENDING_DEPT_COMMENT',
  'PENDING_RA_REVIEW', 'PENDING_SITE_HEAD', 'PENDING_CUSTOMER_COMMENT',
  'PENDING_HEAD_QA', 'PENDING_INVESTIGATION', 'PENDING_ATTACHMENTS',
  'PENDING_VERIFICATION', 'REJECTED', 'CLOSED', 'CANCELLED',
];

// ── Main Page ─────────────────────────────────────────────────────────────────
const QmsPage = () => {
  const [tab,         setTab]         = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCounts, setTotalCounts] = useState({});

  const [rows, setRows] = useState({
    capa: [], deviation: [], incident: [], marketComplaint: [], changeControl: [],
  });
  const [dashboard, setDashboard] = useState(null);

  // Detail drawer state
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailId,      setDetailId]      = useState(null);
  const [detailModule,  setDetailModule]  = useState(null);

  // Create dialog state (one per module)
  const [createOpen, setCreateOpen] = useState({
    capa: false, deviation: false, incident: false, marketComplaint: false, changeControl: false,
  });

  const currentKey = TABS[tab].key;

  const FETCH_APIS = {
    capa:           (p) => getCapasApi(p),
    deviation:      (p) => getDeviationsApi(p),
    incident:       (p) => getIncidentsApi(p),
    marketComplaint:(p) => getComplaintsApi(p),
    changeControl:  (p) => getChangeControlsApi(p),
  };
  const NORM_FNS = {
    capa: normCapa, deviation: normDeviation, incident: normIncident,
    marketComplaint: normComplaint, changeControl: normChangeControl,
  };

  const fetchCurrentTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = {
      search: search || undefined,
      status: statusFilter || undefined,
      page, size: rowsPerPage,
    };
    try {
      const res = await FETCH_APIS[currentKey](params);
      const payload = res.data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setRows((prev) => ({ ...prev, [currentKey]: items.map(NORM_FNS[currentKey]) }));
      setTotalCounts((prev) => ({ ...prev, [currentKey]: payload?.totalElements ?? items.length }));
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [currentKey, search, statusFilter, page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCurrentTab(); }, [fetchCurrentTab]);

  // Load dashboard stats once
  useEffect(() => {
    getQmsDashboardApi().then((r) => setDashboard(r.data?.data || null)).catch(() => {});
  }, []);

  const openDetail = (id) => {
    setDetailId(id);
    setDetailModule(currentKey);
    setDetailOpen(true);
  };

  const openCreate = () => setCreateOpen((p) => ({ ...p, [currentKey]: true }));
  const closeCreate = (key) => setCreateOpen((p) => ({ ...p, [key]: false }));
  const afterCreate = (key) => { closeCreate(key); fetchCurrentTab(); };

  const columns = makeColumns(openDetail);

  const d = dashboard;
  const summaryCards = [
    { label: 'Open CAPAs',         value: d?.openCapaCount     ?? rows.capa.filter((r) => r.status !== 'CLOSED' && r.status !== 'CANCELLED').length,           color: 'warning.main' },
    { label: 'Open Deviations',    value: d?.openDeviationCount ?? rows.deviation.filter((r) => r.status !== 'CLOSED' && r.status !== 'CANCELLED').length,      color: 'info.main' },
    { label: 'Open Incidents',     value: d?.openIncidentCount  ?? rows.incident.filter((r) => r.status !== 'CLOSED' && r.status !== 'CANCELLED').length,       color: 'secondary.main' },
    { label: 'Market Complaints',  value: d?.openComplaintCount ?? rows.marketComplaint.filter((r) => r.status !== 'CLOSED').length,                            color: 'error.main' },
    { label: 'Pending Changes',    value: d?.pendingChangeCount ?? rows.changeControl.filter((r) => r.status?.startsWith('PENDING_')).length,                   color: 'primary.main' },
  ];

  return (
    <Box>
      <PageHeader
        title="Quality Management System"
        subtitle="CAPA · Deviation · Incident · Market Complaint · Change Control"
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'QMS' }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {MODULE_META[currentKey].addLabel}
          </Button>
        }
      />

      {/* Summary cards */}
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); setSearch(''); setStatusFilter(''); }} variant="scrollable" scrollButtons="auto">
          {TABS.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by title or record number…"
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            {STATUS_FILTER_OPTS.filter(Boolean).map((s) => (
              <MenuItem key={s} value={s}>{STATUS_LABELS[s] || s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchCurrentTab}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchCurrentTab} />}

      <DataTable
        columns={columns[currentKey]}
        rows={rows[currentKey]}
        loading={loading}
        totalCount={totalCounts[currentKey] ?? rows[currentKey].length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
      />

      {/* ── Record Detail Drawer ── */}
      <RecordDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        recordId={detailId}
        moduleKey={detailModule}
        onUpdated={fetchCurrentTab}
      />

      {/* ── Create Dialogs ── */}
      <CreateCapaDialog          open={createOpen.capa}           onClose={() => closeCreate('capa')}           onCreated={() => afterCreate('capa')} />
      <CreateDeviationDialog     open={createOpen.deviation}       onClose={() => closeCreate('deviation')}       onCreated={() => afterCreate('deviation')} />
      <CreateIncidentDialog      open={createOpen.incident}        onClose={() => closeCreate('incident')}        onCreated={() => afterCreate('incident')} />
      <CreateChangeControlDialog open={createOpen.changeControl}   onClose={() => closeCreate('changeControl')}   onCreated={() => afterCreate('changeControl')} />
      <CreateComplaintDialog     open={createOpen.marketComplaint} onClose={() => closeCreate('marketComplaint')} onCreated={() => afterCreate('marketComplaint')} />
    </Box>
  );
};

export default QmsPage;
