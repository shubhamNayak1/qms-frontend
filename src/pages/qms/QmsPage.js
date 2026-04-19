import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  Warning as WarningIcon, CheckCircle as CheckIcon, Schedule as AuditIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const MOCK_NC = [
  { id: 1, ncNumber: 'NC-2024-001', title: 'Product Defect in Batch #4421', category: 'Production', severity: 'MAJOR', status: 'OPEN', assignedTo: 'Bob Martinez', reportedDate: '2024-03-15', dueDate: '2024-03-29' },
  { id: 2, ncNumber: 'NC-2024-002', title: 'Documentation Gap in QC Procedure', category: 'Documentation', severity: 'MINOR', status: 'IN_PROGRESS', assignedTo: 'Alice Johnson', reportedDate: '2024-03-18', dueDate: '2024-04-01' },
  { id: 3, ncNumber: 'NC-2024-003', title: 'Calibration Overdue — Equipment ID #E-112', category: 'Equipment', severity: 'CRITICAL', status: 'OPEN', assignedTo: 'Carol Smith', reportedDate: '2024-03-20', dueDate: '2024-03-27' },
  { id: 4, ncNumber: 'NC-2024-004', title: 'Supplier Deviation — Raw Material', category: 'Supplier', severity: 'MAJOR', status: 'CLOSED', assignedTo: 'Emma Wilson', reportedDate: '2024-02-10', dueDate: '2024-02-24' },
  { id: 5, ncNumber: 'NC-2024-005', title: 'Training Record Missing for 3 Employees', category: 'HR', severity: 'MINOR', status: 'IN_PROGRESS', assignedTo: 'Frank Brown', reportedDate: '2024-03-22', dueDate: '2024-04-05' },
];

const MOCK_AUDITS = [
  { id: 1, auditId: 'AUD-2024-Q1', title: 'Q1 Internal Quality Audit', type: 'Internal', scope: 'Production Floor', auditor: 'Alice Johnson', status: 'COMPLETED', scheduledDate: '2024-01-20', findings: 3 },
  { id: 2, auditId: 'AUD-2024-Q2', title: 'Supplier Audit — ABC Components', type: 'Supplier', scope: 'Purchasing', auditor: 'Emma Wilson', status: 'IN_PROGRESS', scheduledDate: '2024-04-10', findings: 1 },
  { id: 3, auditId: 'AUD-2024-EXT', title: 'ISO 9001:2015 Certification Audit', type: 'External', scope: 'Full System', auditor: 'Third Party', status: 'PENDING', scheduledDate: '2024-05-15', findings: 0 },
];

const SEVERITY_COLORS = { CRITICAL: 'error', MAJOR: 'warning', MINOR: 'info', OBSERVATION: 'default' };

const QmsPage = () => {
  const [tab, setTab] = useState(0);
  const [ncRows, setNcRows] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const q = search.toLowerCase();
      setNcRows(MOCK_NC.filter((r) => !q || r.title.toLowerCase().includes(q) || r.ncNumber.toLowerCase().includes(q)));
      setAuditRows(MOCK_AUDITS.filter((r) => !q || r.title.toLowerCase().includes(q) || r.auditId.toLowerCase().includes(q)));
    } catch (err) {
      setError('Failed to load QMS data.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ncColumns = [
    { field: 'ncNumber', headerName: 'NC Number', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 240 },
    { field: 'category', headerName: 'Category', minWidth: 120 },
    { field: 'severity', headerName: 'Severity', minWidth: 110, renderCell: (row) => <Chip label={row.severity} size="small" color={SEVERITY_COLORS[row.severity]} /> },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (row) => <Chip label={row.status.replace('_', ' ')} size="small" color={getStatusColor(row.status)} /> },
    { field: 'assignedTo', headerName: 'Assigned To', minWidth: 140 },
    { field: 'dueDate', headerName: 'Due Date', minWidth: 110, renderCell: (row) => formatDate(row.dueDate) },
  ];

  const auditColumns = [
    { field: 'auditId', headerName: 'Audit ID', minWidth: 130 },
    { field: 'title', headerName: 'Title', minWidth: 240 },
    { field: 'type', headerName: 'Type', minWidth: 100, renderCell: (row) => <Chip label={row.type} size="small" variant="outlined" /> },
    { field: 'auditor', headerName: 'Auditor', minWidth: 140 },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (row) => <Chip label={row.status.replace('_', ' ')} size="small" color={getStatusColor(row.status)} /> },
    { field: 'scheduledDate', headerName: 'Scheduled', minWidth: 120, renderCell: (row) => formatDate(row.scheduledDate) },
    { field: 'findings', headerName: 'Findings', minWidth: 90, align: 'center' },
  ];

  const summaryCards = [
    { label: 'Total NCRs', value: MOCK_NC.length, icon: <WarningIcon />, color: 'error.main' },
    { label: 'Open', value: MOCK_NC.filter((n) => n.status === 'OPEN').length, icon: <WarningIcon />, color: 'warning.main' },
    { label: 'In Progress', value: MOCK_NC.filter((n) => n.status === 'IN_PROGRESS').length, icon: <AuditIcon />, color: 'info.main' },
    { label: 'Closed', value: MOCK_NC.filter((n) => n.status === 'CLOSED').length, icon: <CheckIcon />, color: 'success.main' },
  ];

  return (
    <Box>
      <PageHeader
        title="Quality Management System"
        subtitle="Non-Conformances, Corrective Actions & Audits"
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'QMS' }]}
        action={<Button variant="contained" startIcon={<AddIcon />}>Raise NCR</Button>}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map(({ label, value, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color={color}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Non-Conformances" />
          <Tab label="Audits" />
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

      {tab === 0 && <DataTable columns={ncColumns} rows={ncRows} loading={loading} totalCount={ncRows.length} />}
      {tab === 1 && <DataTable columns={auditColumns} rows={auditRows} loading={loading} totalCount={auditRows.length} />}
    </Box>
  );
};

export default QmsPage;
