import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, TextField, InputAdornment, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert, Typography,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon,
  Download as DownloadIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { getDocumentsApi, uploadDocumentApi, downloadDocumentApi, deleteDocumentApi } from '../../api/dmsApi';
import { ROUTES } from '../../utils/constants';

const normDoc = (d) => ({
  id: d.id,
  docNumber: d.documentNumber || d.docNumber || d.id,
  title: d.title,
  category: d.category || d.documentType || '-',
  version: d.currentVersion || d.version || '1.0',
  status: d.status,
  owner: d.owner?.fullName || d.owner?.name || d.owner || d.createdBy?.fullName || '-',
  updatedAt: d.updatedAt || d.lastModifiedDate || d.createdAt,
  size: d.fileSize ? `${(d.fileSize / 1024 / 1024).toFixed(1)} MB` : (d.size || '-'),
});

const DmsPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', category: 'SOP', version: '1.0' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileRef = useRef();

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getDocumentsApi({ search: search || undefined, page, size: rowsPerPage });
      const payload = data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setRows(items.map(normDoc));
      setTotalCount(payload?.totalElements ?? items.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [search, page, rowsPerPage]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title) { setUploadError('Title and file are required.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const metadata = JSON.stringify({
        title: uploadForm.title,
        category: uploadForm.category,
        version: uploadForm.version,
      });
      formData.append('metadata', new Blob([metadata], { type: 'application/json' }));
      await uploadDocumentApi(formData);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadSuccess(false);
        setSelectedFile(null);
        setUploadForm({ title: '', category: 'SOP', version: '1.0' });
        fetchDocs();
      }, 1200);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (row) => {
    try {
      const { data } = await downloadDocumentApi(row.id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${row.docNumber}-v${row.version}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDocumentApi(id);
      fetchDocs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document.');
    }
  };

  const columns = [
    { field: 'docNumber', headerName: 'Doc Number', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 240 },
    { field: 'category', headerName: 'Category', minWidth: 140, renderCell: (row) => <Chip label={row.category} size="small" variant="outlined" /> },
    { field: 'version', headerName: 'Version', minWidth: 80, align: 'center' },
    { field: 'status', headerName: 'Status', minWidth: 110, renderCell: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> },
    { field: 'owner', headerName: 'Owner', minWidth: 140 },
    { field: 'updatedAt', headerName: 'Last Updated', minWidth: 120, renderCell: (row) => formatDate(row.updatedAt) },
    { field: 'size', headerName: 'Size', minWidth: 80 },
    {
      field: 'actions', headerName: '', align: 'right', minWidth: 120,
      renderCell: (row) => (
        <Box>
          <Tooltip title="View"><IconButton size="small"><ViewIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Download"><IconButton size="small" color="primary" onClick={() => handleDownload(row)}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Document Management System"
        subtitle="Manage SOPs, policies, work instructions and controlled documents."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'DMS' }]}
        action={
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField
          placeholder="Search documents..."
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 320 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Tooltip title="Refresh"><IconButton onClick={fetchDocs}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchDocs} />}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
      />

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
          {uploadSuccess && <Alert severity="success" sx={{ mb: 2 }}>Document uploaded successfully!</Alert>}
          <TextField label="Document Title" fullWidth margin="normal" value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} />
          <TextField label="Category" select fullWidth margin="normal" value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}>
            {['SOP', 'Work Instruction', 'Policy', 'Form', 'Risk Assessment', 'Report'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Version" fullWidth margin="normal" value={uploadForm.version} onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })} />
          <Box
            sx={{ mt: 2, p: 3, border: '2px dashed', borderColor: selectedFile ? 'primary.main' : 'grey.300', borderRadius: 2, textAlign: 'center', cursor: 'pointer', bgcolor: selectedFile ? 'primary.50' : 'grey.50' }}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon sx={{ fontSize: 36, color: selectedFile ? 'primary.main' : 'grey.400', mb: 1 }} />
            <Typography variant="body2" color={selectedFile ? 'primary.main' : 'text.secondary'}>
              {selectedFile ? selectedFile.name : 'Click to select file or drag & drop'}
            </Typography>
            <input ref={fileRef} type="file" hidden onChange={(e) => setSelectedFile(e.target.files[0])} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DmsPage;
