import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, CircularProgress, IconButton,
  MenuItem, Select, Tooltip, Typography, Alert,
  ToggleButton, ToggleButtonGroup, FormControl, InputLabel,
  Snackbar,
} from '@mui/material';
import {
  Add            as AddIcon,
  Download       as DownloadIcon,
  Refresh        as RerunIcon,
  Lightbulb      as InsightIcon,
  History        as HistoryIcon,
  BlockOutlined  as DisableIcon,
  PlayCircle     as EnableIcon,
  HourglassTop   as PendingIcon,
} from '@mui/icons-material';
import PageHeader  from '../../components/PageHeader';
import DataTable   from '../../components/DataTable';
import { ROUTES }  from '../../utils/constants';
import {
  getReportsApi,
  runReportApi,
  downloadReportApi,
  disableReportApi,
  enableReportApi,
} from '../../api/reportsApi';
import CreateReportWizard   from './CreateReportWizard';
import ReportHistoryDialog  from './ReportHistoryDialog';
import ReportInsightsDialog from './ReportInsightsDialog';

// ── Constants ──────────────────────────────────────────────────────────────
const MODULE_OPTIONS = [
  { value: '',               label: 'All Modules' },
  { value: 'CAPA',           label: 'CAPA' },
  { value: 'DEVIATION',      label: 'Deviation' },
  { value: 'INCIDENT',       label: 'Incident' },
  { value: 'CHANGE_CONTROL', label: 'Change Control' },
  { value: 'COMPLAINT',      label: 'Complaint' },
  { value: 'LMS_ENROLLMENT', label: 'LMS Enrollment' },
  { value: 'USER',           label: 'Users' },
];

const STATUS_META = {
  PENDING:   { label: 'Pending',  color: 'default' },
  RUNNING:   { label: 'Running',  color: 'info'    },
  COMPLETED: { label: 'Ready',    color: 'success' },
  FAILED:    { label: 'Failed',   color: 'error'   },
  DISABLED:  { label: 'Disabled', color: 'warning' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)   return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtSize = (bytes) => {
  if (bytes == null) return '—';
  if (bytes < 1024)  return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Sub-components ─────────────────────────────────────────────────────────
const StatusChip = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, color: 'default' };
  if (status === 'RUNNING') {
    return (
      <Chip
        size="small"
        color="info"
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CircularProgress size={10} color="inherit" />
            Running
          </Box>
        }
      />
    );
  }
  if (status === 'PENDING') {
    return (
      <Chip
        size="small"
        color="default"
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PendingIcon sx={{ fontSize: 12 }} />
            Pending
          </Box>
        }
      />
    );
  }
  return <Chip size="small" color={meta.color} label={meta.label} />;
};

const ModuleChip = ({ module }) => {
  const label = MODULE_OPTIONS.find((m) => m.value === module)?.label || module;
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      sx={{ fontSize: '0.7rem', fontWeight: 600 }}
    />
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const ReportsPage = () => {
  // ── State ──────────────────────────────────────────────────────────────
  const [rows,          setRows]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [page,          setPage]          = useState(0);
  const [rowsPerPage,   setRowsPerPage]   = useState(20);
  const [filter,        setFilter]        = useState('all');   // 'all' | 'mine'
  const [moduleFilter,  setModuleFilter]  = useState('');
  const [actionLoading, setActionLoading] = useState({});     // { [id]: true }
  const [error,         setError]         = useState(null);

  // Dialogs
  const [wizardOpen,   setWizardOpen]   = useState(false);
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  // Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity });

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async (pg = page, rpp = rowsPerPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pg,
        size: rpp,
        ...(filter === 'mine'    && { mine: true }),
        ...(moduleFilter         && { module: moduleFilter }),
      };
      const res = await getReportsApi(params);
      setRows(res.data?.data?.content     || []);
      setTotalElements(res.data?.data?.totalElements ?? 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filter, moduleFilter]);

  useEffect(() => {
    fetchReports(0, rowsPerPage);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, moduleFilter]);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);

  // ── Action helpers ─────────────────────────────────────────────────────
  const setBusy = (id, busy) =>
    setActionLoading((prev) => ({ ...prev, [id]: busy }));

  const handleRerun = async (report) => {
    setBusy(report.id, true);
    try {
      const res = await runReportApi(report.id);
      const updated = res.data?.data;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showToast('Report re-run successfully.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Re-run failed.', 'error');
    } finally {
      setBusy(report.id, false);
    }
  };

  const handleDownload = async (report) => {
    if (report.status !== 'COMPLETED') {
      showToast('Report is not ready for download yet.', 'warning');
      return;
    }
    setBusy(report.id, true);
    try {
      const res = await downloadReportApi(report.id);
      triggerDownload(res.data, report.fileName || `report_${report.id}.xlsx`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Download failed.', 'error');
    } finally {
      setBusy(report.id, false);
    }
  };

  const handleDisable = async (report) => {
    setBusy(report.id, true);
    try {
      const res = await disableReportApi(report.id);
      const updated = res.data?.data;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showToast('Report disabled.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setBusy(report.id, false);
    }
  };

  const handleEnable = async (report) => {
    setBusy(report.id, true);
    try {
      const res = await enableReportApi(report.id);
      const updated = res.data?.data;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showToast('Report enabled.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setBusy(report.id, false);
    }
  };

  const openHistory  = (report) => { setActiveReport(report); setHistoryOpen(true);  };
  const openInsights = (report) => { setActiveReport(report); setInsightsOpen(true); };

  const handleCreated = (newReport) => {
    showToast('Report created — file is ready to download!');
    fetchReports(0, rowsPerPage);
    setPage(0);
  };

  // ── Columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      field: 'name',
      headerName: 'Report Name',
      minWidth: 220,
      renderCell: (r) => (
        <Box>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 240 }}>
            {r.name}
          </Typography>
          {r.description && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 240, display: 'block' }}>
              {r.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'module',
      headerName: 'Module',
      minWidth: 140,
      renderCell: (r) => <ModuleChip module={r.module} />,
    },
    {
      field: 'format',
      headerName: 'Format',
      minWidth: 80,
      renderCell: (r) => (
        <Chip
          label={r.format}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.68rem' }}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 110,
      renderCell: (r) => <StatusChip status={r.status} />,
    },
    {
      field: 'lastRunAt',
      headerName: 'Last Run',
      minWidth: 120,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">
          {fmtDate(r.lastRunAt)}
        </Typography>
      ),
    },
    {
      field: 'runCount',
      headerName: 'Runs',
      minWidth: 60,
      align: 'center',
      renderCell: (r) => (
        <Typography variant="body2" color="text.secondary">{r.runCount ?? 0}</Typography>
      ),
    },
    {
      field: 'fileSizeBytes',
      headerName: 'Size',
      minWidth: 80,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">
          {r.status === 'COMPLETED' ? fmtSize(r.fileSizeBytes) : '—'}
        </Typography>
      ),
    },
    {
      field: 'createdByUsername',
      headerName: 'Created By',
      minWidth: 110,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">
          {r.createdByUsername || '—'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 200,
      align: 'right',
      renderCell: (r) => {
        const busy       = !!actionLoading[r.id];
        const isDisabled = r.isDisabled || r.status === 'DISABLED';
        const canDL      = r.status === 'COMPLETED';
        return (
          <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
            {/* Download */}
            <Tooltip title={canDL ? 'Download' : 'Not ready'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={!canDL || busy}
                  onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                >
                  {busy ? <CircularProgress size={14} /> : <DownloadIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>

            {/* Re-run */}
            <Tooltip title={isDisabled ? 'Enable first' : 'Re-run'}>
              <span>
                <IconButton
                  size="small"
                  color="secondary"
                  disabled={isDisabled || busy}
                  onClick={(e) => { e.stopPropagation(); handleRerun(r); }}
                >
                  <RerunIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Insights */}
            <Tooltip title="Insights">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); openInsights(r); }}
              >
                <InsightIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* History */}
            <Tooltip title="Run History">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); openHistory(r); }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Disable / Enable */}
            {isDisabled ? (
              <Tooltip title="Enable Report">
                <IconButton
                  size="small"
                  color="success"
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); handleEnable(r); }}
                >
                  <EnableIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Disable Report">
                <IconButton
                  size="small"
                  color="warning"
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); handleDisable(r); }}
                >
                  <DisableIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Build, run, and download custom reports across all QMS modules."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.DASHBOARD },
          { label: 'Reports' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setWizardOpen(true)}
          >
            New Report
          </Button>
        }
      />

      {/* ── Filter bar ── */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 2,
          mb: 2.5, flexWrap: 'wrap',
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_e, v) => { if (v) setFilter(v); }}
        >
          <ToggleButton value="all"  sx={{ px: 2.5 }}>All Reports</ToggleButton>
          <ToggleButton value="mine" sx={{ px: 2.5 }}>My Reports</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Module</InputLabel>
          <Select
            label="Module"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            {MODULE_OPTIONS.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" color="text.secondary">
          {totalElements} report{totalElements !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        totalCount={totalElements}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_e, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        emptyMessage="No reports yet. Click '+ New Report' to create one."
      />

      {/* ── Dialogs ── */}
      <CreateReportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />

      <ReportHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        report={activeReport}
      />

      <ReportInsightsDialog
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        report={activeReport}
      />

      {/* ── Toast ── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReportsPage;
