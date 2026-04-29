import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, TextField, InputAdornment, IconButton,
  Tooltip, Typography, Alert, MenuItem, Select, FormControl,
  InputLabel, Grid, Card, CardContent, ToggleButton,
  ToggleButtonGroup, Snackbar,
} from '@mui/material';
import {
  Search        as SearchIcon,
  Refresh       as RefreshIcon,
  CloudUpload   as UploadIcon,
  OpenInNew     as OpenIcon,
  Download      as DownloadIcon,
} from '@mui/icons-material';
import PageHeader           from '../../components/PageHeader';
import DataTable            from '../../components/DataTable';
import { formatDate }       from '../../utils/helpers';
import { ROUTES }           from '../../utils/constants';
import {
  getDocumentsApi,
  getDocumentStatsApi,
  downloadDocumentApi,
  acknowledgeDocumentApi,
} from '../../api/dmsApi';
import UploadDocumentDialog from './UploadDocumentDialog';
import DocumentDetailDrawer from './DocumentDetailDrawer';
import { DOC_CATEGORIES }   from './UploadDocumentDialog';

// ── Status metadata ────────────────────────────────────────────────────────
const STATUS_META = {
  DRAFT:        { label: 'Draft',        color: 'default'  },
  UNDER_REVIEW: { label: 'Under Review', color: 'warning'  },
  APPROVED:     { label: 'Approved',     color: 'info'     },
  EFFECTIVE:    { label: 'Effective',    color: 'success'  },
  REJECTED:     { label: 'Rejected',     color: 'error'    },
  OBSOLETE:     { label: 'Obsolete',     color: 'default'  },
  WITHDRAWN:    { label: 'Withdrawn',    color: 'warning'  },
  SUPERSEDED:   { label: 'Superseded',   color: 'default'  },
};

const ALL_STATUSES = Object.keys(STATUS_META);

// ── Helpers ────────────────────────────────────────────────────────────────
const normDoc = (d) => ({
  id:           d.id,
  documentNumber: d.documentNumber || d.docNumber || String(d.id),
  title:        d.title || '—',
  category:     d.category || '—',
  version:      d.currentVersion || d.version || '1.0',
  status:       d.status || 'DRAFT',
  accessLevel:  d.accessLevel || '—',
  isControlled: d.isControlled || false,
  owner:        d.owner?.fullName || d.owner?.username || d.createdBy?.fullName || '—',
  department:   d.department || '—',
  updatedAt:    d.updatedAt || d.createdAt,
  fileSize:     d.fileSize,
  fileName:     d.fileName,
});

const fmtSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const triggerBlobDownload = (data, fileName) => {
  const url = URL.createObjectURL(new Blob([data]));
  const a   = document.createElement('a');
  a.href    = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Main Page ──────────────────────────────────────────────────────────────
const DmsPage = () => {
  // ── List state ──────────────────────────────────────────────────────────
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [totalCount,  setTotalCount]  = useState(0);
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // ── Filters ─────────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode,       setViewMode]       = useState('all'); // 'all' | 'effective'

  // ── Stats ────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  // ── Dialogs ─────────────────────────────────────────────────────────────
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [drawerDocId, setDrawerDocId] = useState(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  // ── Download busy ────────────────────────────────────────────────────────
  const [dlBusy, setDlBusy] = useState({});

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity });

  // ── Fetch documents ──────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (pg = page, rpp = rowsPerPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pg,
        size: rpp,
        ...(search         && { search }),
        ...(statusFilter   && { status:   statusFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(viewMode === 'effective' && { status: 'EFFECTIVE' }),
      };
      const { data } = await getDocumentsApi(params);
      const payload  = data?.data;
      const items    = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setRows(items.map(normDoc));
      setTotalCount(payload?.totalElements ?? items.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, categoryFilter, viewMode]);

  // Fetch stats once on mount
  useEffect(() => {
    getDocumentStatsApi()
      .then(({ data }) => setStats(data?.data || null))
      .catch(() => {});
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
    fetchDocs(0, rowsPerPage);
  }, [search, statusFilter, categoryFilter, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on page / rpp change
  useEffect(() => {
    fetchDocs();
  }, [page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline quick-download ────────────────────────────────────────────────
  const handleQuickDownload = async (row) => {
    setDlBusy((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res   = await downloadDocumentApi(row.id);
      const s3Url = res.headers?.['x-download-url'];
      if (s3Url) {
        window.open(s3Url, '_blank');
        const logId = res.headers?.['x-download-log-id'];
        if (row.isControlled && logId) {
          await acknowledgeDocumentApi(logId).catch(() => {});
        }
      } else {
        triggerBlobDownload(
          res.data,
          row.fileName || `${row.documentNumber}-v${row.version}`
        );
      }
    } catch (_) {
      showToast('Download failed.', 'error');
    } finally {
      setDlBusy((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  const openDrawer = (row) => { setDrawerDocId(row.id); setDrawerOpen(true); };

  // ── Summary stats cards ──────────────────────────────────────────────────
  const statCards = [
    {
      label: 'Total Documents',
      value: stats?.totalDocuments ?? totalCount,
      color: 'primary.main',
    },
    {
      label: 'Effective',
      value: stats?.effectiveDocuments ?? rows.filter((r) => r.status === 'EFFECTIVE').length,
      color: 'success.main',
    },
    {
      label: 'Under Review',
      value: stats?.underReviewDocuments ?? rows.filter((r) => r.status === 'UNDER_REVIEW').length,
      color: 'warning.main',
    },
    {
      label: 'Draft',
      value: stats?.draftDocuments ?? rows.filter((r) => r.status === 'DRAFT').length,
      color: 'text.secondary',
    },
  ];

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = [
    {
      field: 'documentNumber',
      headerName: 'Doc #',
      minWidth: 140,
      renderCell: (r) => (
        <Typography
          variant="caption"
          fontFamily="monospace"
          fontWeight={600}
          color="primary.main"
          noWrap
        >
          {r.documentNumber}
        </Typography>
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      minWidth: 220,
      renderCell: (r) => (
        <Box>
          <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 260 }}>
            {r.title}
          </Typography>
          {r.isControlled && (
            <Chip label="Controlled" size="small" variant="outlined" color="warning"
              sx={{ fontSize: '0.6rem', height: 16, mt: 0.25 }} />
          )}
        </Box>
      ),
    },
    {
      field: 'category',
      headerName: 'Category',
      minWidth: 140,
      renderCell: (r) => {
        const cat = DOC_CATEGORIES.find((c) => c.value === r.category);
        const label = cat
          ? cat.label.split(' – ')[0].split(' /')[0]
          : (r.category || '—');
        return <Chip label={label} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />;
      },
    },
    {
      field: 'version',
      headerName: 'Version',
      minWidth: 80,
      align: 'center',
      renderCell: (r) => (
        <Chip label={`v${r.version}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      renderCell: (r) => {
        const m = STATUS_META[r.status] || { label: r.status, color: 'default' };
        return <Chip label={m.label} size="small" color={m.color} />;
      },
    },
    {
      field: 'accessLevel',
      headerName: 'Access',
      minWidth: 110,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">{r.accessLevel}</Typography>
      ),
    },
    {
      field: 'owner',
      headerName: 'Owner',
      minWidth: 130,
      renderCell: (r) => (
        <Typography variant="caption" noWrap>{r.owner}</Typography>
      ),
    },
    {
      field: 'updatedAt',
      headerName: 'Last Updated',
      minWidth: 110,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">{formatDate(r.updatedAt)}</Typography>
      ),
    },
    {
      field: 'fileSize',
      headerName: 'Size',
      minWidth: 80,
      renderCell: (r) => (
        <Typography variant="caption" color="text.secondary">{fmtSize(r.fileSize)}</Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 100,
      align: 'right',
      renderCell: (r) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Open Details">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDrawer(r); }}>
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Quick Download">
            <IconButton
              size="small"
              color="primary"
              disabled={!!dlBusy[r.id]}
              onClick={(e) => { e.stopPropagation(); handleQuickDownload(r); }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        title="Document Management"
        subtitle="Upload, review, approve and control your organisation's documents."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'DMS' }]}
        action={
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        }
      />

      {/* ── Stats row ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(({ label, value, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card>
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Typography variant="h4" fontWeight={700} color={color}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Filter bar ── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search title, number…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewMode}
          onChange={(_, v) => { if (v) setViewMode(v); }}
        >
          <ToggleButton value="all"       sx={{ px: 2 }}>All</ToggleButton>
          <ToggleButton value="effective" sx={{ px: 2 }}>Effective Only</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={viewMode === 'effective'}
          >
            <MenuItem value="">All Statuses</MenuItem>
            {ALL_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Category</InputLabel>
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {DOC_CATEGORIES.map(({ value, label }) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Refresh">
          <IconButton onClick={() => fetchDocs(page, rowsPerPage)} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {totalCount} document{totalCount !== 1 ? 's' : ''}
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
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        emptyMessage="No documents found. Click 'Upload Document' to add one."
      />

      {/* ── Upload Dialog ── */}
      <UploadDocumentDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          showToast('Document uploaded successfully!');
          fetchDocs(0, rowsPerPage);
          setPage(0);
        }}
      />

      {/* ── Detail Drawer ── */}
      <DocumentDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        docId={drawerDocId}
        onUpdated={() => {
          showToast('Document updated.');
          fetchDocs(page, rowsPerPage);
        }}
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
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DmsPage;
