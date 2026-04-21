import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Divider, MenuItem, TextField, LinearProgress,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { getStatusColor } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';
import { getReportsDashboardApi } from '../../api/reportsApi';

const QMS_SUMMARY = [
  { metric: 'Total Non-Conformances', thisMonth: 12, lastMonth: 15, trend: -20, status: 'IMPROVED' },
  { metric: 'Critical NCRs', thisMonth: 2, lastMonth: 4, trend: -50, status: 'IMPROVED' },
  { metric: 'Avg Resolution Days', thisMonth: 8, lastMonth: 11, trend: -27, status: 'IMPROVED' },
  { metric: 'Open Corrective Actions', thisMonth: 7, lastMonth: 6, trend: 17, status: 'ATTENTION' },
  { metric: 'Audits Conducted', thisMonth: 3, lastMonth: 2, trend: 50, status: 'IMPROVED' },
];

const DMS_SUMMARY = [
  { metric: 'Documents Created', thisMonth: 18, lastMonth: 12, trend: 50, status: 'IMPROVED' },
  { metric: 'Documents Approved', thisMonth: 14, lastMonth: 10, trend: 40, status: 'IMPROVED' },
  { metric: 'Pending Review', thisMonth: 23, lastMonth: 8, trend: 188, status: 'ATTENTION' },
  { metric: 'Documents Archived', thisMonth: 5, lastMonth: 7, trend: -29, status: 'NORMAL' },
  { metric: 'Avg Review Days', thisMonth: 4, lastMonth: 6, trend: -33, status: 'IMPROVED' },
];

const LMS_SUMMARY = [
  { metric: 'New Enrollments', thisMonth: 34, lastMonth: 28, trend: 21, status: 'IMPROVED' },
  { metric: 'Completions', thisMonth: 29, lastMonth: 22, trend: 32, status: 'IMPROVED' },
  { metric: 'Completion Rate', thisMonth: '85%', lastMonth: '79%', trend: 8, status: 'IMPROVED' },
  { metric: 'Overdue Trainings', thisMonth: 5, lastMonth: 9, trend: -44, status: 'IMPROVED' },
  { metric: 'Avg Score', thisMonth: '88%', lastMonth: '84%', trend: 5, status: 'IMPROVED' },
];

const MODULE_STATS = [
  { module: 'QMS', kpi: 'Compliance Rate', value: 94, target: 95, color: 'warning' },
  { module: 'DMS', kpi: 'Doc Currency Rate', value: 87, target: 90, color: 'info' },
  { module: 'LMS', kpi: 'Training Completion', value: 85, target: 90, color: 'warning' },
  { module: 'Users', kpi: 'Active Users', value: 97, target: 95, color: 'success' },
];

const ReportTable = ({ data }) => (
  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          {['Metric', 'This Month', 'Last Month', 'Trend', 'Status'].map((h) => (
            <TableCell key={h} sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>{h}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.metric} hover>
            <TableCell><Typography variant="body2" fontWeight={500}>{row.metric}</Typography></TableCell>
            <TableCell><Typography variant="body2" fontWeight={700}>{row.thisMonth}</Typography></TableCell>
            <TableCell><Typography variant="body2" color="text.secondary">{row.lastMonth}</Typography></TableCell>
            <TableCell>
              <Typography variant="body2" color={row.trend < 0 ? (row.status === 'IMPROVED' ? 'success.main' : 'error.main') : (row.status === 'IMPROVED' ? 'success.main' : 'warning.main')}>
                {row.trend > 0 ? '▲' : '▼'} {Math.abs(row.trend)}%
              </Typography>
            </TableCell>
            <TableCell>
              <Chip
                label={row.status}
                size="small"
                color={row.status === 'IMPROVED' ? 'success' : row.status === 'ATTENTION' ? 'warning' : 'default'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const ReportsPage = () => {
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState('monthly');
  const [dashData, setDashData] = useState(null);

  useEffect(() => {
    getReportsDashboardApi()
      .then(({ data }) => setDashData(data?.data || null))
      .catch(() => {});
  }, []);

  const tableData = [null, QMS_SUMMARY, DMS_SUMMARY, LMS_SUMMARY][tab];
  const d = dashData;

  return (
    <Box>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Key performance indicators across all QMS modules."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Reports' }]}
        action={
          <Button variant="outlined" startIcon={<DownloadIcon />}>
            Export Report
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {MODULE_STATS.map(({ module, kpi, value, target, color }) => (
          <Grid item xs={12} sm={6} lg={3} key={module}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">{module} — {kpi}</Typography>
                  <Chip label={`Target: ${target}%`} size="small" variant="outlined" />
                </Box>
                <Typography variant="h4" fontWeight={700} color={`${color}.main`}>{value}%</Typography>
                <LinearProgress variant="determinate" value={value} sx={{ mt: 1, height: 6, borderRadius: 3 }} color={color} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Overview" />
              <Tab label="QMS Report" />
              <Tab label="DMS Report" />
              <Tab label="LMS Report" />
            </Tabs>
            <TextField
              select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ width: 140 }}
              label="Period"
            >
              {['monthly', 'quarterly', 'annual'].map((p) => (
                <MenuItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {tab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Executive Summary — Monthly Overview</Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'System-Wide NCRs', value: d?.totalNcr ?? 34, delta: '-12%', up: false },
                    { label: 'Docs Under Control', value: d?.totalDocuments ?? '1,204', delta: '+18 this month', up: true },
                    { label: 'Training Completions', value: d?.totalCompletions ?? 87, delta: '+32%', up: true },
                    { label: 'Overall Compliance', value: d?.overallComplianceRate ? `${d.overallComplianceRate}%` : '92%', delta: '+2%', up: true },
                  ].map(({ label, value, delta, up }) => (
                    <Grid item xs={6} md={3} key={label}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="h5" fontWeight={700}>{value}</Typography>
                        <Typography variant="caption" color={up ? 'success.main' : 'error.main'}>{delta}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          )}

          {tab > 0 && tableData && <ReportTable data={tableData} />}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportsPage;
