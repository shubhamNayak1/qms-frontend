import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  LinearProgress,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const MOCK_COURSES = [
  { id: 1, courseCode: 'ISO-001', title: 'ISO 9001:2015 Foundation', category: 'Compliance', duration: '4 hours', enrollments: 48, completions: 42, status: 'ACTIVE', dueDate: '2024-04-30' },
  { id: 2, courseCode: 'EHS-003', title: 'Workplace Health & Safety', category: 'Safety', duration: '2 hours', enrollments: 87, completions: 80, status: 'ACTIVE', dueDate: '2024-03-31' },
  { id: 3, courseCode: 'QMS-007', title: 'Root Cause Analysis Techniques', category: 'Quality', duration: '3 hours', enrollments: 32, completions: 18, status: 'ACTIVE', dueDate: '2024-05-15' },
  { id: 4, courseCode: 'DATA-002', title: 'GDPR & Data Privacy', category: 'Compliance', duration: '1.5 hours', enrollments: 102, completions: 99, status: 'ARCHIVED', dueDate: '2023-12-31' },
  { id: 5, courseCode: 'LEAD-005', title: 'Leadership & Change Management', category: 'Management', duration: '6 hours', enrollments: 22, completions: 5, status: 'ACTIVE', dueDate: '2024-06-01' },
];

const MOCK_ENROLLMENTS = [
  { id: 1, employee: 'Alice Johnson', courseCode: 'ISO-001', courseName: 'ISO 9001:2015 Foundation', enrolledDate: '2024-03-01', completedDate: '2024-03-10', progress: 100, status: 'COMPLETED', score: 92 },
  { id: 2, employee: 'Bob Martinez', courseCode: 'EHS-003', courseName: 'Workplace Health & Safety', enrolledDate: '2024-03-05', completedDate: null, progress: 65, status: 'IN_PROGRESS', score: null },
  { id: 3, employee: 'Carol Smith', courseCode: 'QMS-007', courseName: 'Root Cause Analysis Techniques', enrolledDate: '2024-03-10', completedDate: null, progress: 30, status: 'IN_PROGRESS', score: null },
  { id: 4, employee: 'David Lee', courseCode: 'ISO-001', courseName: 'ISO 9001:2015 Foundation', enrolledDate: '2024-02-15', completedDate: null, progress: 0, status: 'PENDING', score: null },
  { id: 5, employee: 'Emma Wilson', courseCode: 'DATA-002', courseName: 'GDPR & Data Privacy', enrolledDate: '2023-11-01', completedDate: '2023-11-15', progress: 100, status: 'COMPLETED', score: 88 },
];

const LmsPage = () => {
  const [tab, setTab] = useState(0);
  const [courseRows, setCourseRows] = useState([]);
  const [enrollmentRows, setEnrollmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const q = search.toLowerCase();
      setCourseRows(MOCK_COURSES.filter((r) => !q || r.title.toLowerCase().includes(q) || r.courseCode.toLowerCase().includes(q)));
      setEnrollmentRows(MOCK_ENROLLMENTS.filter((r) => !q || r.employee.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q)));
    } catch {
      setError('Failed to load LMS data.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overallCompletionRate = Math.round(
    (MOCK_ENROLLMENTS.filter((e) => e.status === 'COMPLETED').length / MOCK_ENROLLMENTS.length) * 100
  );

  const courseColumns = [
    { field: 'courseCode', headerName: 'Code', minWidth: 100 },
    { field: 'title', headerName: 'Course Title', minWidth: 260 },
    { field: 'category', headerName: 'Category', minWidth: 120, renderCell: (row) => <Chip label={row.category} size="small" variant="outlined" /> },
    { field: 'duration', headerName: 'Duration', minWidth: 90, align: 'center' },
    { field: 'enrollments', headerName: 'Enrolled', minWidth: 80, align: 'center' },
    {
      field: 'completionRate', headerName: 'Completion', minWidth: 140,
      renderCell: (row) => {
        const pct = Math.round((row.completions / (row.enrollments || 1)) * 100);
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{pct}%</Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3 }} color={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'error'} />
          </Box>
        );
      },
    },
    { field: 'status', headerName: 'Status', minWidth: 100, renderCell: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> },
    { field: 'dueDate', headerName: 'Due Date', minWidth: 110, renderCell: (row) => formatDate(row.dueDate) },
  ];

  const enrollmentColumns = [
    { field: 'employee', headerName: 'Employee', minWidth: 150 },
    { field: 'courseCode', headerName: 'Course Code', minWidth: 120 },
    { field: 'courseName', headerName: 'Course', minWidth: 230 },
    { field: 'enrolledDate', headerName: 'Enrolled', minWidth: 110, renderCell: (row) => formatDate(row.enrolledDate) },
    {
      field: 'progress', headerName: 'Progress', minWidth: 140,
      renderCell: (row) => (
        <Box sx={{ width: '100%' }}>
          <Typography variant="caption">{row.progress}%</Typography>
          <LinearProgress variant="determinate" value={row.progress} sx={{ height: 5, borderRadius: 3 }} color={row.progress === 100 ? 'success' : row.progress > 0 ? 'info' : 'inherit'} />
        </Box>
      ),
    },
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (row) => <Chip label={row.status.replace('_', ' ')} size="small" color={getStatusColor(row.status)} /> },
    { field: 'score', headerName: 'Score', minWidth: 80, align: 'center', renderCell: (row) => row.score ? `${row.score}%` : '—' },
    { field: 'completedDate', headerName: 'Completed', minWidth: 110, renderCell: (row) => formatDate(row.completedDate) },
  ];

  return (
    <Box>
      <PageHeader
        title="Learning Management System"
        subtitle="Training courses, enrollments and compliance records."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'LMS' }]}
        action={<Button variant="contained" startIcon={<AddIcon />}>Create Course</Button>}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Courses', value: MOCK_COURSES.length, color: 'primary.main' },
          { label: 'Active Courses', value: MOCK_COURSES.filter((c) => c.status === 'ACTIVE').length, color: 'success.main' },
          { label: 'Total Enrollments', value: MOCK_ENROLLMENTS.length, color: 'info.main' },
          { label: 'Completion Rate', value: `${overallCompletionRate}%`, color: 'warning.main' },
        ].map(({ label, value, color }) => (
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
          <Tab label="Courses" />
          <Tab label="Enrollments" />
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

      {tab === 0 && <DataTable columns={courseColumns} rows={courseRows} loading={loading} totalCount={courseRows.length} />}
      {tab === 1 && <DataTable columns={enrollmentColumns} rows={enrollmentRows} loading={loading} totalCount={enrollmentRows.length} />}
    </Box>
  );
};

export default LmsPage;
