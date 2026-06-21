import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, CardContent, Typography,
  MenuItem, Select, FormControl, InputLabel,
  LinearProgress, Stack, Paper, Collapse, FormControlLabel, Switch,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
  Warning as WarningIcon,
  CheckCircle as ClosedIcon,
  HourglassEmpty as InProgressIcon,
  FolderOpen as OpenRecIcon,
  PriorityHigh as CriticalIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
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
  disabled: r.disabled || false,
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
  disabled: r.disabled || false,
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
  disabled: r.disabled || false,
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
  disabled: r.disabled || false,
});
const normChangeControl = (r) => ({
  id: r.id,
  refNumber: refNum(r, 'CC'),
  title: r.title,
  changeType: r.changeType || '—',
  // Round-3 R20: the home-page Risk column reads from `category` (set by
  // QA at Phase 1 — Critical / Major / Minor), falling back to the legacy
  // riskLevel column for older records.
  riskLevel: r.category || r.riskLevel || '—',
  priority: r.priority,
  status: r.status,
  implementationDate: r.implementationDate,
  overdue: r.overdue,
  disabled: r.disabled || false,
});


// ── Columns per module ────────────────────────────────────────────────────────
const DisabledBadge = ({ disabled }) =>
  disabled ? <Chip label="Disabled" size="small" color="default" variant="outlined"
    sx={{ fontSize: '0.6rem', height: 16, mt: 0.25 }} /> : null;

const makeColumns = (openDetail) => ({
  // Round-3 R1: per-module column widths tuned so the table fits a typical
  // ~1100px laptop viewport without horizontal scroll. Priority dropped on
  // CC (replaced by Risk per R20). Title columns flex; everything else uses
  // tight minWidths.
  capa: [
    { field: 'refNumber',   headerName: 'CAPA #',      minWidth: 110 },
    { field: 'title',       headerName: 'Title',        minWidth: 180,
      renderCell: (r) => <Box sx={{ opacity: r.disabled ? 0.55 : 1 }}><Typography variant="body2" noWrap>{r.title}</Typography><DisabledBadge disabled={r.disabled} /></Box> },
    { field: 'capaType',    headerName: 'Type',         minWidth: 90 },
    { field: 'source',      headerName: 'Source',       minWidth: 90 },
    { field: 'department',  headerName: 'Dept',         minWidth: 90 },
    { field: 'priority',    headerName: 'Priority',     minWidth: 90, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',      headerName: 'Status',       minWidth: 130, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'dueDate',     headerName: 'Due',          minWidth: 90, renderCell: (r) => formatDate(r.dueDate) },
    { field: 'actions',     headerName: '',             minWidth: 48,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  deviation: [
    { field: 'refNumber',     headerName: 'DEV #',       minWidth: 110 },
    { field: 'title',         headerName: 'Title',        minWidth: 180,
      renderCell: (r) => <Box sx={{ opacity: r.disabled ? 0.55 : 1 }}><Typography variant="body2" noWrap>{r.title}</Typography><DisabledBadge disabled={r.disabled} /></Box> },
    { field: 'deviationType', headerName: 'Type',         minWidth: 90 },
    { field: 'department',    headerName: 'Dept',         minWidth: 90 },
    { field: 'productBatch',  headerName: 'Batch',        minWidth: 90 },
    { field: 'priority',      headerName: 'Priority',     minWidth: 90, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',        headerName: 'Status',       minWidth: 130, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'createdAt',     headerName: 'Reported',     minWidth: 90, renderCell: (r) => formatDate(r.createdAt) },
    { field: 'actions',       headerName: '',             minWidth: 48,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  incident: [
    { field: 'refNumber',      headerName: 'INC #',        minWidth: 110 },
    { field: 'title',          headerName: 'Title',         minWidth: 180,
      renderCell: (r) => <Box sx={{ opacity: r.disabled ? 0.55 : 1 }}><Typography variant="body2" noWrap>{r.title}</Typography><DisabledBadge disabled={r.disabled} /></Box> },
    { field: 'incidentType',   headerName: 'Type',          minWidth: 90 },
    { field: 'incidentSubType',headerName: 'Sub-Type',      minWidth: 90 },
    { field: 'severity',       headerName: 'Severity',      minWidth: 80,  renderCell: (r) => <Chip label={r.severity || '—'} size="small" color={PRIORITY_COLORS[r.severity?.toUpperCase()] || 'default'} variant="outlined" /> },
    { field: 'priority',       headerName: 'Priority',      minWidth: 90, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',         headerName: 'Status',        minWidth: 130, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'occurrenceDate', headerName: 'Date',          minWidth: 90, renderCell: (r) => formatDate(r.occurrenceDate) },
    { field: 'actions',        headerName: '',              minWidth: 48,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  marketComplaint: [
    { field: 'refNumber',        headerName: 'MC #',          minWidth: 110 },
    { field: 'title',            headerName: 'Complaint',      minWidth: 170,
      renderCell: (r) => <Box sx={{ opacity: r.disabled ? 0.55 : 1 }}><Typography variant="body2" noWrap>{r.title}</Typography><DisabledBadge disabled={r.disabled} /></Box> },
    { field: 'customerName',     headerName: 'Customer',       minWidth: 110 },
    { field: 'productName',      headerName: 'Product',        minWidth: 100 },
    { field: 'complaintCategory',headerName: 'Category',       minWidth: 90 },
    { field: 'priority',         headerName: 'Priority',       minWidth: 90, renderCell: (r) => <PriorityChip priority={r.priority} /> },
    { field: 'status',           headerName: 'Status',         minWidth: 130, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'receivedDate',     headerName: 'Received',       minWidth: 90, renderCell: (r) => formatDate(r.receivedDate) },
    { field: 'actions',          headerName: '',               minWidth: 48,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
  changeControl: [
    // Round-3 R1: Impl. Date column dropped (cluttered the row).
    // Round-3 R20: Priority column replaced by Risk (Critical/Major/Minor).
    { field: 'refNumber',        headerName: 'CC #',           minWidth: 110 },
    { field: 'title',            headerName: 'Change Title',    minWidth: 180,
      renderCell: (r) => <Box sx={{ opacity: r.disabled ? 0.55 : 1 }}><Typography variant="body2" noWrap>{r.title}</Typography><DisabledBadge disabled={r.disabled} /></Box> },
    { field: 'changeType',       headerName: 'Type',            minWidth: 90 },
    { field: 'riskLevel',        headerName: 'Risk',            minWidth: 80,
      renderCell: (r) => r.riskLevel && r.riskLevel !== '—'
        ? <Chip label={r.riskLevel} size="small"
                color={r.riskLevel === 'Critical' ? 'error'
                     : r.riskLevel === 'Major'    ? 'warning'
                     : r.riskLevel === 'Minor'    ? 'info' : 'default'}
                variant="outlined" />
        : <Typography variant="caption" color="text.disabled">—</Typography> },
    { field: 'status',           headerName: 'Status',          minWidth: 130, renderCell: (r) => <StatusChip status={r.status} /> },
    { field: 'actions',          headerName: '',                minWidth: 48,  align: 'right',
      renderCell: (r) => <Tooltip title="View"><IconButton size="small" onClick={() => openDetail(r.id)}><OpenIcon fontSize="small" /></IconButton></Tooltip> },
  ],
});

// ── Dashboard Section ─────────────────────────────────────────────────────────

const MODULE_DASH = [
  {
    label: 'CAPA', color: '#7b1fa2', bg: '#f3e5f5',
    stats: (d) => [
      { label: 'Open',        value: d.capaOpen,       color: '#e65100' },
      { label: 'In Progress', value: d.capaInProgress, color: '#1565c0' },
      { label: 'Closed',      value: d.capaClosed,     color: '#2e7d32' },
    ],
    badges: (d) => [
      d.capaOverdue  > 0 && { label: `${d.capaOverdue} Overdue`,   icon: <WarningIcon sx={{ fontSize: 12 }} />, color: 'error'   },
      d.capaCritical > 0 && { label: `${d.capaCritical} Critical`, icon: <CriticalIcon sx={{ fontSize: 12 }} />, color: 'warning' },
    ].filter(Boolean),
  },
  {
    label: 'Deviation', color: '#1565c0', bg: '#e3f2fd',
    stats: (d) => [
      { label: 'Open',        value: d.deviationOpen,       color: '#e65100' },
      { label: 'In Progress', value: d.deviationInProgress, color: '#1565c0' },
      { label: 'Closed',      value: d.deviationClosed,     color: '#2e7d32' },
    ],
    badges: (d) => [
      d.deviationOverdue > 0 && { label: `${d.deviationOverdue} Overdue`, icon: <WarningIcon sx={{ fontSize: 12 }} />, color: 'error' },
    ].filter(Boolean),
  },
  {
    label: 'Incident', color: '#c62828', bg: '#ffebee',
    stats: (d) => [
      { label: 'Open',        value: d.incidentOpen,       color: '#e65100' },
      { label: 'In Progress', value: d.incidentInProgress, color: '#1565c0' },
      { label: 'Closed',      value: d.incidentClosed,     color: '#2e7d32' },
    ],
    badges: (d) => [
      d.incidentOverdue         > 0 && { label: `${d.incidentOverdue} Overdue`,          icon: <WarningIcon sx={{ fontSize: 12 }} />,  color: 'error'   },
      d.incidentCriticalSeverity> 0 && { label: `${d.incidentCriticalSeverity} Critical`, icon: <CriticalIcon sx={{ fontSize: 12 }} />, color: 'warning' },
    ].filter(Boolean),
  },
  {
    label: 'Change Control', color: '#2e7d32', bg: '#e8f5e9',
    stats: (d) => [
      { label: 'Open',            value: d.changeControlOpen,             color: '#e65100' },
      { label: 'Pending Approval',value: d.changeControlPendingApproval,  color: '#f57f17' },
      { label: 'Closed',          value: d.changeControlClosed,           color: '#2e7d32' },
    ],
    badges: (d) => [
      d.changeControlOverdue > 0 && { label: `${d.changeControlOverdue} Overdue`, icon: <WarningIcon sx={{ fontSize: 12 }} />, color: 'error' },
    ].filter(Boolean),
  },
  {
    label: 'Market Complaint', color: '#e65100', bg: '#fff3e0',
    stats: (d) => [
      { label: 'Open',        value: d.complaintOpen,       color: '#e65100' },
      { label: 'In Progress', value: d.complaintInProgress, color: '#1565c0' },
      { label: 'Closed',      value: d.complaintClosed,     color: '#2e7d32' },
    ],
    badges: (d) => [
      d.complaintOverdue             > 0 && { label: `${d.complaintOverdue} Overdue`,       icon: <WarningIcon sx={{ fontSize: 12 }} />, color: 'error'   },
      d.complaintReportableToAuthority>0 && { label: `${d.complaintReportableToAuthority} Reportable`, icon: <CriticalIcon sx={{ fontSize: 12 }} />, color: 'warning' },
    ].filter(Boolean),
  },
];

const STATUS_DASH_ROWS = [
  { key: 'DRAFT',          label: 'Draft',           color: '#9e9e9e' },
  { key: 'PENDING_REVIEW', label: 'Pending Review',  color: '#ff9800' },
  { key: 'CLOSED',         label: 'Closed',          color: '#4caf50' },
  { key: 'REJECTED',       label: 'Rejected',        color: '#f44336' },
  { key: 'CANCELLED',      label: 'Cancelled',       color: '#757575' },
];

const PRIORITY_DASH_ROWS = [
  { key: 'CRITICAL', label: 'Critical', color: '#d32f2f' },
  { key: 'HIGH',     label: 'High',     color: '#f57c00' },
  { key: 'MEDIUM',   label: 'Medium',   color: '#1976d2' },
  { key: 'LOW',      label: 'Low',      color: '#388e3c' },
];

const QmsDashboardSection = ({ dashboard: d, open, onToggle }) => {
  if (!d) return null;

  const statusTotal  = Object.values(d.statusBreakdown   || {}).reduce((a, b) => a + b, 0) || 1;
  const priorityTotal= Object.values(d.priorityBreakdown || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <Box sx={{ mb: 3 }}>
      {/* ── Compact always-visible bar ── */}
      <Paper
        variant="outlined"
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: 1, px: 2, py: 1, mb: 1.5, borderRadius: 2,
          cursor: 'pointer', userSelect: 'none',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <InsightsIcon fontSize="small" color="primary" />
        <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mr: 1 }}>
          QMS Insights
        </Typography>
        {[
          { label: 'Open',       value: d.totalOpenRecords,    color: 'warning' },
          { label: 'Overdue',    value: d.totalOverdueRecords,  color: d.totalOverdueRecords > 0 ? 'error' : 'default' },
          { label: 'Pending',    value: d.statusBreakdown?.PENDING_REVIEW ?? 0, color: 'info' },
          { label: 'Closed',     value: d.statusBreakdown?.CLOSED ?? 0,        color: 'success' },
          { label: 'Critical',   value: d.priorityBreakdown?.CRITICAL ?? 0,    color: (d.priorityBreakdown?.CRITICAL ?? 0) > 0 ? 'error' : 'default' },
        ].map(({ label, value, color }) => (
          <Chip key={label} label={`${label}: ${value}`} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
        ))}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
          <Typography variant="caption" sx={{ mr: 0.5 }}>{open ? 'Hide' : 'Full Insights'}</Typography>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Paper>

      {/* ── Collapsible full dashboard ── */}
      <Collapse in={open}>
      {/* ── Row 1: Hero KPIs ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2, borderColor: 'warning.main', borderWidth: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}><OpenRecIcon sx={{ color: 'warning.main', fontSize: 28 }} /></Box>
            <Typography variant="h3" fontWeight={800} color="warning.main">{d.totalOpenRecords}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Open Records</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2, borderColor: d.totalOverdueRecords > 0 ? 'error.main' : 'divider', borderWidth: d.totalOverdueRecords > 0 ? 2 : 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}><WarningIcon sx={{ color: d.totalOverdueRecords > 0 ? 'error.main' : 'text.disabled', fontSize: 28 }} /></Box>
            <Typography variant="h3" fontWeight={800} color={d.totalOverdueRecords > 0 ? 'error.main' : 'text.secondary'}>{d.totalOverdueRecords}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Overdue</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}><InProgressIcon sx={{ color: 'info.main', fontSize: 28 }} /></Box>
            <Typography variant="h3" fontWeight={800} color="info.main">{d.statusBreakdown?.PENDING_REVIEW ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Pending Review</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}><ClosedIcon sx={{ color: 'success.main', fontSize: 28 }} /></Box>
            <Typography variant="h3" fontWeight={800} color="success.main">{d.statusBreakdown?.CLOSED ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Closed</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Row 2: Per-Module Cards ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {MODULE_DASH.map((m) => {
          const stats  = m.stats(d);
          const badges = m.badges(d);
          return (
            <Grid item xs={12} sm={6} lg key={m.label}>
              <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', height: '100%' }}>
                {/* Coloured header */}
                <Box sx={{ bgcolor: m.color, px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="white">{m.label}</Typography>
                  {badges.length > 0 && (
                    <Stack direction="row" spacing={0.5}>
                      {badges.map((b, i) => (
                        <Chip key={i} icon={b.icon} label={b.label} size="small" color={b.color}
                          sx={{ height: 20, fontSize: 10, '& .MuiChip-icon': { ml: '4px' }, '& .MuiChip-label': { px: '6px' } }} />
                      ))}
                    </Stack>
                  )}
                </Box>
                {/* Stat cells */}
                <CardContent sx={{ bgcolor: m.bg, p: '12px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                    {stats.map((s) => (
                      <Box key={s.label} sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: s.color, lineHeight: 1.1 }}>{s.value ?? 0}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{s.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Row 3: Status + Priority Breakdown ── */}
      <Grid container spacing={2}>
        {/* Status Breakdown */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Status Breakdown</Typography>
            <Stack spacing={1.2}>
              {STATUS_DASH_ROWS.map(({ key, label, color }) => {
                const val = d.statusBreakdown?.[key] ?? 0;
                const pct = Math.round((val / statusTotal) * 100);
                return (
                  <Box key={key}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
                      <Typography variant="caption" fontWeight={700}>{val}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </Grid>

        {/* Priority Breakdown */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Priority Breakdown</Typography>
            <Stack spacing={1.5}>
              {PRIORITY_DASH_ROWS.map(({ key, label, color }) => {
                const val = d.priorityBreakdown?.[key] ?? 0;
                const pct = Math.round((val / priorityTotal) * 100);
                return (
                  <Box key={key}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
                      </Box>
                      <Typography variant="caption" fontWeight={700}>{val}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </Grid>
      </Grid>
      </Collapse>
    </Box>
  );
};

const TABS = [
  { label: 'CAPA',             key: 'capa',            path: ROUTES.QMS_CAPA },
  { label: 'Deviation',        key: 'deviation',        path: ROUTES.QMS_DEVIATION },
  { label: 'Incident',         key: 'incident',         path: ROUTES.QMS_INCIDENT },
  { label: 'Market Complaint', key: 'marketComplaint',  path: ROUTES.QMS_MARKET_COMPLAINT },
  { label: 'Change Control',   key: 'changeControl',    path: ROUTES.QMS_CHANGE_CONTROL },
];

// Resolve URL pathname → tab index (default 0 = CAPA)
const pathToTabIndex = (pathname) => {
  const idx = TABS.findIndex((t) => pathname === t.path || pathname.startsWith(t.path + '/'));
  return idx >= 0 ? idx : 0;
};

const STATUS_FILTER_OPTS = [
  '', 'DRAFT', 'PENDING_HOD', 'PENDING_QA_REVIEW', 'PENDING_DEPT_COMMENT',
  'PENDING_RA_REVIEW', 'PENDING_SITE_HEAD', 'PENDING_CUSTOMER_COMMENT',
  'PENDING_HEAD_QA', 'PENDING_INVESTIGATION', 'PENDING_ATTACHMENTS',
  'PENDING_VERIFICATION', 'REJECTED', 'CLOSED', 'CANCELLED',
];

// ── Main Page ─────────────────────────────────────────────────────────────────
const QmsPage = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  // Tab index is derived from the URL
  const tab = useMemo(() => pathToTabIndex(location.pathname), [location.pathname]);

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
  const [insightOpen, setInsightOpen] = useState(false);
  const [includeDisabled, setIncludeDisabled] = useState(false);

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
      const normalized = items.map(NORM_FNS[currentKey]);
      setRows((prev) => ({ ...prev, [currentKey]: includeDisabled ? normalized : normalized.filter((r) => !r.disabled) }));
      setTotalCounts((prev) => ({ ...prev, [currentKey]: payload?.totalElements ?? items.length }));
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [currentKey, search, statusFilter, page, rowsPerPage, includeDisabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCurrentTab(); }, [fetchCurrentTab]);

  // Redirect bare /qms → /qms/capa so URL is always explicit
  useEffect(() => {
    if (location.pathname === ROUTES.QMS || location.pathname === ROUTES.QMS + '/') {
      navigate(ROUTES.QMS_CAPA, { replace: true });
    }
  }, [location.pathname, navigate]);

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


  return (
    <Box>
      <PageHeader
        title="Quality Management System"
        subtitle="CAPA · Deviation · Incident · Market Complaint · Change Control"
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'QMS' }]}
      />

      {/* Dashboard — compact bar + collapsible full view */}
      <QmsDashboardSection
        dashboard={dashboard}
        open={insightOpen}
        onToggle={() => setInsightOpen((p) => !p)}
      />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => {
            navigate(TABS[v].path, { replace: true });
            setPage(0); setSearch(''); setStatusFilter('');
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </Box>

      {/* Filters + Create button */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search by title or record number…"
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 170 }}>
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
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={includeDisabled}
              onChange={(e) => { setIncludeDisabled(e.target.checked); setPage(0); }}
            />
          }
          label="Include Disabled"
        />
        <Box sx={{ ml: 'auto' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {MODULE_META[currentKey].addLabel}
          </Button>
        </Box>
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
