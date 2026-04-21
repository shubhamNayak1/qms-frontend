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
import { getProgramsApi, getEnrollmentsApi, getLmsComplianceDashboardApi } from '../../api/lmsApi';

const normProgram = (p) => ({
  id: p.id,
  courseCode: p.code || p.courseCode || `PRG-${p.id}`,
  title: p.title,
  category: p.category || '-',
  duration: p.estimatedDurationMinutes ? `${p.estimatedDurationMinutes} min` : (p.duration || '-'),
  enrollments: p.enrollmentCount ?? p.enrollments ?? 0,
  completions: p.completionCount ?? p.completions ?? 0,
  status: p.status,
  dueDate: p.dueDate || null,
});

const normEnrollment = (e) => ({
  id: e.id,
  employee: e.user?.fullName || e.user?.name || e.employee || '-',
  courseCode: e.program?.code || e.program?.courseCode || e.courseCode || '-',
  courseName: e.program?.title || e.courseName || '-',
  enrolledDate: e.enrolledAt || e.enrolledDate || e.createdAt,
  completedDate: e.completedAt || e.completedDate || null,
  progress: e.progressPercent ?? e.progress ?? 0,
  status: e.status,
  score: e.assessmentScore ?? e.score ?? null,
});

const LmsPage = () => {
  const [tab, setTab] = useState(0);
  const [courseRows, setCourseRows] = useState([]);
  const [enrollmentRows, setEnrollmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [lmsDash, setLmsDash] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { search: search || undefined, page, size: rowsPerPage };
    try {
      if (tab === 0) {
        const { data } = await getProgramsApi(params);
        const payload = data?.data;
        const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
        setCourseRows(items.map(normProgram));
        setTotalCount(payload?.totalElements ?? items.length);
      } else {
        const { data } = await getEnrollmentsApi(params);
        const payload = data?.data;
        const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
        setEnrollmentRows(items.map(normEnrollment));
        setTotalCount(payload?.totalElements ?? items.length);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load LMS data.');
    } finally {
      setLoading(false);
    }
  }, [search, page, rowsPerPage, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    getLmsComplianceDashboardApi()
      .then(({ data }) => setLmsDash(data?.data || null))
      .catch(() => {});
  }, []);

  const handleTabChange = (_, v) => { setTab(v); setPage(0); };

  const totalCourses = lmsDash?.activeProgramCount ?? courseRows.length;
  const activeCourses = lmsDash?.activeProgramCount ?? courseRows.filter((c) => c.status === 'ACTIVE').length;
  const totalEnrollments = lmsDash?.totalEnrollments ?? enrollmentRows.length;
  const completionRate = lmsDash?.overallComplianceRate
    ? `${lmsDash.overallComplianceRate}%`
    : enrollmentRows.length > 0
      ? `${Math.round((enrollmentRows.filter((e) => e.status === 'COMPLETED').length / enrollmentRows.length) * 100)}%`
      : '—';

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
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (row) => <Chip label={row.status?.replace('_', ' ')} size="small" color={getStatusColor(row.status)} /> },
    { field: 'score', headerName: 'Score', minWidth: 80, align: 'center', renderCell: (row) => row.score != null ? `${row.score}%` : '—' },
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
          { label: 'Total Courses', value: totalCourses, color: 'primary.main' },
          { label: 'Active Courses', value: activeCourses, color: 'success.main' },
          { label: 'Total Enrollments', value: totalEnrollments, color: 'info.main' },
          { label: 'Completion Rate', value: completionRate, color: 'warning.main' },
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
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="Courses" />
          <Tab label="Enrollments" />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField
          placeholder="Search..."
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Tooltip title="Refresh"><IconButton onClick={fetchData}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      {tab === 0 && (
        <DataTable
          columns={courseColumns}
          rows={courseRows}
          loading={loading}
          totalCount={totalCount}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        />
      )}
      {tab === 1 && (
        <DataTable
          columns={enrollmentColumns}
          rows={enrollmentRows}
          loading={loading}
          totalCount={totalCount}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        />
      )}
    </Box>
  );
};

export default LmsPage;
