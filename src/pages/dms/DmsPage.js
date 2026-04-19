import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, TextField, InputAdornment, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  Download as DownloadIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { uploadDocumentApi } from '../../api/dmsApi';
import { ROUTES } from '../../utils/constants';

const MOCK_DOCS = [
  { id: 1, docNumber: 'SOP-QC-023', title: 'Quality Control Procedure', category: 'SOP', version: '3.2', status: 'PUBLISHED', owner: 'Alice Johnson', updatedAt: '2024-03-20', size: '2.4 MB' },
  { id: 2, docNumber: 'WI-PROD-007', title: 'Production Work Instruction — Line 4', category: 'Work Instruction', version: '1.5', status: 'DRAFT', owner: 'Bob Martinez', updatedAt: '2024-03-22', size: '1.1 MB' },
  { id: 3, docNumber: 'FORM-HR-012', title: 'Employee Training Record Form', category: 'Form', version: '2.0', status: 'PUBLISHED', owner: 'Carol Smith', updatedAt: '2024-02-15', size: '0.3 MB' },
  { id: 4, docNumber: 'POL-EHS-001', title: 'Environmental Health & Safety Policy', category: 'Policy', version: '4.1', status: 'APPROVED', owner: 'Emma Wilson', updatedAt: '2024-01-30', size: '0.8 MB' },
  { id: 5, docNumber: 'RA-OPS-005', title: 'Operational Risk Assessment 2024', category: 'Risk Assessment', version: '1.0', status: 'PENDING', owner: 'Frank Brown', updatedAt: '2024-03-25', size: '3.7 MB' },
  { id: 6, docNumber: 'SOP-LAB-009', title: 'Laboratory Testing SOP', category: 'SOP', version: '2.3', status: 'ARCHIVED', owner: 'David Lee', updatedAt: '2023-12-01', size: '1.9 MB' },
];

const DmsPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
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
      await new Promise((r) => setTimeout(r, 500));
      const q = search.toLowerCase();
      setRows(MOCK_DOCS.filter((d) => !q || d.title.toLowerCase().includes(q) || d.docNumber.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)));
    } catch (err) {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title) { setUploadError('Title and file are required.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadForm.title);
      formData.append('category', uploadForm.category);
      formData.append('version', uploadForm.version);
      // await uploadDocumentApi(formData); // uncomment for live API
      await new Promise((r) => setTimeout(r, 700));
      setUploadSuccess(true);
      setTimeout(() => { setUploadOpen(false); setUploadSuccess(false); setSelectedFile(null); setUploadForm({ title: '', category: 'SOP', version: '1.0' }); fetchDocs(); }, 1200);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
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
          <Tooltip title="Download"><IconButton size="small" color="primary"><DownloadIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Tooltip title="Refresh"><IconButton onClick={fetchDocs}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchDocs} />}

      <DataTable columns={columns} rows={rows} loading={loading} totalCount={rows.length} />

      {/* Upload Dialog */}
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
