import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Button, Chip, Tabs, Tab, TextField, InputAdornment,
  IconButton, Tooltip, Grid, Card, Typography,
  LinearProgress, Stack, Paper, Collapse, MenuItem, Select,
  FormControl, InputLabel,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  OpenInNew as OpenIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  School as SchoolIcon, PeopleAlt as PeopleIcon,
  Warning as WarningIcon, CheckCircle as CertIcon,
  Insights as InsightsIcon, PersonAdd as EnrollIcon,
  Assignment as ComplianceIcon, Quiz as QuizIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';
import {
  getProgramsApi, getEnrollmentsApi, getLmsComplianceDashboardApi,
  getCertificatesApi,
} from '../../api/lmsApi';
import {
  PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS, ENROLLMENT_STATUS_LABELS,
  TRAINING_TYPE_COLORS, TRAINING_TYPE_LABELS, CERT_STATUS_COLORS,
} from './lmsConstants';
import CreateProgramDialog from './CreateProgramDialog';
import ProgramDetailDrawer from './ProgramDetailDrawer';
import EnrollDialog        from './EnrollDialog';
import ComplianceDialog    from './ComplianceDialog';
import ExamDialog          from './ExamDialog';

// ── Tab routing ───────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Programs',     path: ROUTES.LMS_PROGRAMS },
  { label: 'Enrollments',  path: ROUTES.LMS_ENROLLMENTS },
  { label: 'Compliance',   path: ROUTES.LMS_COMPLIANCE },
  { label: 'Certificates', path: ROUTES.LMS_CERTIFICATES },
];

const pathToTabIndex = (pathname) => {
  const idx = TABS.findIndex((t) => pathname === t.path || pathname.startsWith(t.path + '/'));
  return idx >= 0 ? idx : 0;
};

// ── Status chips ──────────────────────────────────────────────────────────────
const ProgramStatusChip = ({ status }) => (
  <Chip size="small"
    label={PROGRAM_STATUS_LABELS[status] || status?.replace(/_/g, ' ') || '—'}
    color={PROGRAM_STATUS_COLORS[status] || 'default'} />
);

const EnrollmentStatusChip = ({ status }) => (
  <Chip size="small"
    label={ENROLLMENT_STATUS_LABELS[status] || status?.replace(/_/g, ' ') || '—'}
    color={ENROLLMENT_STATUS_COLORS[status] || 'default'} />
);

// ── Normalizers ───────────────────────────────────────────────────────────────
const normProgram = (p) => ({
  id:           p.id,
  code:         p.code || `PRG-${p.id}`,
  title:        p.title,
  trainingType: p.trainingType,
  trainingSubType: p.trainingSubType,
  category:     p.category || '—',
  department:   p.departments || p.department || '—',
  status:       p.status,
  isMandatory:  p.isMandatory,
  examEnabled:  p.examEnabled,
  disabled:     p.disabled || false,
  totalEnrollments:    p.totalEnrollments ?? 0,
  completedEnrollments:p.completedEnrollments ?? 0,
  complianceRate:      p.complianceRate ?? 0,
  createdAt:    p.createdAt,
});

const normEnrollment = (e) => ({
  id:               e.id,
  userName:         e.userName || '—',
  userDept:         e.userDepartment || '—',
  programCode:      e.programCode || '—',
  programTitle:     e.programTitle || '—',
  trainingType:     e.trainingType || e.programTrainingType || '',
  status:           e.status,
  progress:         e.progressPercent ?? 0,
  dueDate:          e.dueDate,
  overdue:          e.overdue,
  completedAt:      e.completedAt,
  lastScore:        e.lastScore,
  attemptsUsed:     e.attemptsUsed,
  examEnabled:      e.examEnabled || e.programExamEnabled || false,
});

const normCert = (c) => ({
  id:                c.id,
  certificateNumber: c.certificateNumber,
  userName:          c.userName || '—',
  programCode:       c.programCode || '—',
  programTitle:      c.programTitle || '—',
  issuedDate:        c.issuedDate,
  expiryDate:        c.expiryDate,
  status:            c.status,
  scoreAchieved:     c.scoreAchieved,
  expired:           c.expired,
});

// ── Compliance Dashboard ──────────────────────────────────────────────────────
const LmsDashboard = ({ dash: d, open, onToggle }) => {
  if (!d) return null;
  const compRate  = d.overallComplianceRate ?? 0;
  const total     = d.totalEnrollments ?? 0;
  const overdue   = d.overdueCount ?? 0;
  const dueSoon   = d.dueSoonEnrollments ?? [];
  const expiring  = d.expiringSoonCertificates ?? [];

  return (
    <Box sx={{ mb: 3 }}>
      {/* ── Compact always-visible bar ── */}
      <Paper variant="outlined" onClick={onToggle}
        sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
              px: 2, py: 1, mb: 1.5, borderRadius: 2, cursor: 'pointer', userSelect: 'none',
              '&:hover': { bgcolor: 'action.hover' } }}>
        <InsightsIcon fontSize="small" color="primary" />
        <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mr: 1 }}>LMS Insights</Typography>
        {[
          { label: 'Programs',   value: d.activePrograms ?? 0,              color: 'primary'  },
          { label: 'Enrolled',   value: total,                               color: 'info'     },
          { label: 'In Progress',value: d.inProgressCount ?? 0,             color: 'info'     },
          { label: 'Overdue',    value: overdue,                             color: overdue > 0 ? 'error' : 'default' },
          { label: 'Compliance', value: `${compRate.toFixed(0)}%`,          color: compRate >= 80 ? 'success' : compRate >= 50 ? 'warning' : 'error' },
          { label: 'Certs',      value: d.activeCertificates ?? 0,          color: 'success'  },
        ].map(({ label, value, color }) => (
          <Chip key={label} label={`${label}: ${value}`} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
        ))}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
          <Typography variant="caption" sx={{ mr: 0.5 }}>{open ? 'Hide' : 'Full Insights'}</Typography>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Paper>

      {/* ── Full collapsible dashboard ── */}
      <Collapse in={open}>

        {/* Row 1 — Hero KPIs */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: 'Total Enrollments', value: total,                              color: 'info.main',    Icon: PeopleIcon },
            { label: 'Active Programs',   value: d.activePrograms ?? 0,             color: 'primary.main', Icon: SchoolIcon },
            { label: 'Mandatory Programs',value: d.mandatoryPrograms ?? 0,          color: 'warning.main', Icon: SchoolIcon },
            { label: 'Compliance Rate',   value: `${compRate.toFixed(1)}%`,         color: compRate >= 80 ? 'success.main' : compRate >= 50 ? 'warning.main' : 'error.main', Icon: CertIcon },
            { label: 'Active Certs',      value: d.activeCertificates ?? 0,         color: 'success.main', Icon: CertIcon },
            { label: 'Overdue',           value: overdue,                            color: overdue > 0 ? 'error.main' : 'text.secondary', Icon: WarningIcon },
          ].map(({ label, value, color, Icon }) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                  <Icon sx={{ color, fontSize: 24 }} />
                </Box>
                <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 10 }}>{label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Row 2 — Enrollment Breakdown + Due Soon */}
        <Grid container spacing={2} sx={{ mb: 2 }}>

          {/* Enrollment Status Breakdown */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Enrollment Breakdown</Typography>
              <Stack spacing={1}>
                {[
                  { key: 'allocatedCount',   label: 'Allocated',    color: '#9e9e9e' },
                  { key: 'inProgressCount',  label: 'In Progress',  color: '#1976d2' },
                  { key: 'completedCount',   label: 'Completed',    color: '#2e7d32' },
                  { key: 'retrainingCount',  label: 'Retraining',   color: '#e65100' },
                  { key: 'failedCount',      label: 'Failed',       color: '#d32f2f' },
                  { key: 'expiredCount',     label: 'Expired',      color: '#757575' },
                  { key: 'waivedCount',      label: 'Waived',       color: '#7b1fa2' },
                  { key: 'cancelledCount',   label: 'Cancelled',    color: '#bdbdbd' },
                ].map(({ key, label, color }) => {
                  const val = d[key] ?? 0;
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                  return (
                    <Box key={key}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
                        <Typography variant="caption" fontWeight={700}>{val}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 6, borderRadius: 4, bgcolor: '#f0f0f0',
                              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }} />
                    </Box>
                  );
                })}
              </Stack>
            </Card>
          </Grid>

          {/* Due Soon Enrollments */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Due Soon
                {dueSoon.length > 0 && <Chip label={dueSoon.length} size="small" color="warning" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
              </Typography>
              {dueSoon.length === 0 ? (
                <Typography variant="caption" color="text.disabled">No upcoming due dates.</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {dueSoon.slice(0, 6).map((e) => (
                    <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                          p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} display="block">
                          {e.userName || `User #${e.userId}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {e.programCode || e.programTitle || `Program #${e.programId}`}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip label={formatDate(e.dueDate)} size="small" color="warning" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                          {(e.status || '').replace(/_/g, ' ')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  {dueSoon.length > 6 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      +{dueSoon.length - 6} more…
                    </Typography>
                  )}
                </Stack>
              )}
            </Card>
          </Grid>

          {/* Department Compliance / Expiring Certs */}
          <Grid item xs={12} md={4}>
            {d.complianceByDepartment && Object.keys(d.complianceByDepartment).length > 0 ? (
              <Card variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Dept Compliance</Typography>
                <Stack spacing={1}>
                  {Object.entries(d.complianceByDepartment).map(([dept, rate]) => (
                    <Box key={dept}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">{dept}</Typography>
                        <Typography variant="caption" fontWeight={700}>{rate.toFixed(1)}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={Math.min(rate, 100)}
                        color={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}
                        sx={{ height: 6, borderRadius: 4 }} />
                    </Box>
                  ))}
                </Stack>
              </Card>
            ) : (
              <Card variant="outlined" sx={{ borderRadius: 2, p: 2, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Expiring Certs
                  {expiring.length > 0 && <Chip label={expiring.length} size="small" color="error" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                </Typography>
                {expiring.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">No certificates expiring soon.</Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {expiring.slice(0, 5).map((c) => (
                      <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Box>
                          <Typography variant="caption" fontWeight={700} display="block">{c.userName}</Typography>
                          <Typography variant="caption" color="text.secondary">{c.programCode}</Typography>
                        </Box>
                        <Chip label={formatDate(c.expiryDate)} size="small" color="error" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>
            )}
          </Grid>
        </Grid>
      </Collapse>
    </Box>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const LmsPage = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  const tab = useMemo(() => pathToTabIndex(location.pathname), [location.pathname]);

  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(0);
  const [rowsPerPage,  setRowsPerPage]  = useState(20);
  const [totalCount,   setTotalCount]   = useState(0);

  const [programRows,    setProgramRows]    = useState([]);
  const [enrollmentRows, setEnrollmentRows] = useState([]);
  const [certRows,       setCertRows]       = useState([]);

  const [dash,        setDash]        = useState(null);
  const [insightOpen, setInsightOpen] = useState(false);

  const [createOpen, setCreateOpen]  = useState(false);
  const [detailOpen, setDetailOpen]  = useState(false);
  const [detailId,   setDetailId]    = useState(null);
  const [enrollOpen, setEnrollOpen]  = useState(false);
  const [enrollProgram, setEnrollProgram] = useState(null);

  const [complianceOpen,       setComplianceOpen]       = useState(false);
  const [complianceEnrollId,   setComplianceEnrollId]   = useState(null);
  const [examOpen,             setExamOpen]             = useState(false);
  const [examEnrollment,       setExamEnrollment]       = useState(null);

  // Redirect bare /lms → /lms/programs
  useEffect(() => {
    if (location.pathname === ROUTES.LMS || location.pathname === ROUTES.LMS + '/') {
      navigate(ROUTES.LMS_PROGRAMS, { replace: true });
    }
  }, [location.pathname, navigate]);

  const fetchTab = useCallback(async () => {
    setLoading(true); setError(null);
    const params = { search: search || undefined, status: statusFilter || undefined, page, size: rowsPerPage };
    try {
      if (tab === 0) {
        const { data } = await getProgramsApi(params);
        const payload = data?.data;
        const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
        setProgramRows(items.map(normProgram));
        setTotalCount(payload?.totalElements ?? items.length);
      } else if (tab === 1) {
        const { data } = await getEnrollmentsApi(params);
        const payload = data?.data;
        const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
        setEnrollmentRows(items.map(normEnrollment));
        setTotalCount(payload?.totalElements ?? items.length);
      } else if (tab === 2) {
        // Compliance — pending enrollments (PENDING_REVIEW, PENDING_HR_REVIEW, PENDING_QA_APPROVAL)
        const pendingParams = {
          ...params,
          status: statusFilter || undefined,
        };
        const { data } = await getEnrollmentsApi({
          ...pendingParams,
          status: statusFilter || 'PENDING_REVIEW',
        });
        const payload = data?.data;
        const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
        setEnrollmentRows(items.map(normEnrollment));
        setTotalCount(payload?.totalElements ?? items.length);
      } else if (tab === 3) {
        // Certificates
        try {
          const { data } = await getCertificatesApi(params);
          const payload = data?.data;
          const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
          setCertRows(items.map(normCert));
          setTotalCount(payload?.totalElements ?? items.length);
        } catch {
          setCertRows([]);
          setTotalCount(0);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [tab, search, statusFilter, page, rowsPerPage]);

  useEffect(() => { fetchTab(); }, [fetchTab]);

  useEffect(() => {
    getLmsComplianceDashboardApi()
      .then(({ data }) => setDash(data?.data || null))
      .catch(() => {});
  }, []);

  const handleTabChange = (_, v) => {
    navigate(TABS[v].path, { replace: true });
    setPage(0); setSearch(''); setStatusFilter('');
  };

  const openDetail = (id) => { setDetailId(id); setDetailOpen(true); };
  const openEnroll = (row) => { setEnrollProgram(row); setEnrollOpen(true); };
  const openCompliance = (enrollId) => { setComplianceEnrollId(enrollId); setComplianceOpen(true); };
  const openExam = (row) => { setExamEnrollment(row); setExamOpen(true); };

  // ── Program columns ──────────────────────────────────────────────────────────
  const programColumns = [
    { field: 'code',  headerName: 'Code', minWidth: 110,
      renderCell: (r) => <Typography variant="caption" fontFamily="monospace" fontWeight={700}>{r.code}</Typography> },
    { field: 'title', headerName: 'Training Program', minWidth: 240 },
    { field: 'trainingType', headerName: 'Type', minWidth: 120,
      renderCell: (r) => (
        <Stack direction="row" spacing={0.5}>
          <Chip size="small" label={TRAINING_TYPE_LABELS[r.trainingType] || r.trainingType}
            color={TRAINING_TYPE_COLORS[r.trainingType] || 'default'} />
        </Stack>
      )},
    { field: 'category',  headerName: 'Category',   minWidth: 100 },
    { field: 'department',headerName: 'Dept',        minWidth: 100 },
    { field: 'isMandatory', headerName: 'Mandatory', minWidth: 90, align: 'center',
      renderCell: (r) => r.isMandatory ? <Chip label="Yes" size="small" color="warning" /> : <Typography variant="caption" color="text.disabled">No</Typography> },
    { field: 'status', headerName: 'Status', minWidth: 160, renderCell: (r) => (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <ProgramStatusChip status={r.status} />
        {r.disabled && <Chip label="Disabled" size="small" color="default" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
      </Box>
    )},
    { field: 'complianceRate', headerName: 'Compliance', minWidth: 140,
      renderCell: (r) => {
        const pct = Math.round(r.complianceRate);
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{pct}% ({r.completedEnrollments}/{r.totalEnrollments})</Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3, mt: 0.25 }}
              color={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'error'} />
          </Box>
        );
      }},
    { field: 'actions', headerName: '', minWidth: 90, align: 'right',
      renderCell: (r) => (
        <Box>
          <Tooltip title="Enroll Users">
            <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); openEnroll(r); }}>
              <EnrollIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(r.id); }}>
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )},
  ];

  // ── Enrollment columns ───────────────────────────────────────────────────────
  const enrollmentColumns = [
    { field: 'userName',     headerName: 'Trainee',  minWidth: 150 },
    { field: 'userDept',     headerName: 'Dept',     minWidth: 110 },
    { field: 'programCode',  headerName: 'Code',     minWidth: 100,
      renderCell: (r) => <Typography variant="caption" fontFamily="monospace">{r.programCode}</Typography> },
    { field: 'programTitle', headerName: 'Program',  minWidth: 200 },
    { field: 'progress', headerName: 'Progress', minWidth: 140,
      renderCell: (r) => (
        <Box sx={{ width: '100%' }}>
          <Typography variant="caption">{r.progress}%</Typography>
          <LinearProgress variant="determinate" value={r.progress} sx={{ height: 5, borderRadius: 3, mt: 0.25 }}
            color={r.progress === 100 ? 'success' : r.progress > 0 ? 'info' : 'inherit'} />
        </Box>
      )},
    { field: 'status', headerName: 'Status', minWidth: 160, renderCell: (r) => <EnrollmentStatusChip status={r.status} /> },
    { field: 'dueDate', headerName: 'Due', minWidth: 100,
      renderCell: (r) => (
        <Typography variant="caption" color={r.overdue ? 'error.main' : 'text.primary'} fontWeight={r.overdue ? 700 : 400}>
          {r.overdue && '⚠ '}{formatDate(r.dueDate) || '—'}
        </Typography>
      )},
    { field: 'lastScore', headerName: 'Score', minWidth: 80, align: 'center',
      renderCell: (r) => r.lastScore != null ? `${r.lastScore.toFixed(0)}%` : '—' },
    { field: 'completedAt', headerName: 'Completed', minWidth: 110, renderCell: (r) => formatDate(r.completedAt) },
    {
      field: 'actions', headerName: '', minWidth: 100, align: 'right',
      renderCell: (r) => {
        const examReady = r.examEnabled && r.status === 'IN_PROGRESS';
        const complianceActive = ['IN_PROGRESS','PENDING_REVIEW','PENDING_HR_REVIEW','PENDING_QA_APPROVAL'].includes(r.status);
        return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {complianceActive && (
              <Tooltip title="Compliance Workflow">
                <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); openCompliance(r.id); }}>
                  <ComplianceIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {examReady && (
              <Tooltip title="Take Online Exam">
                <IconButton size="small" color="secondary" onClick={(e) => { e.stopPropagation(); openExam(r); }}>
                  <QuizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ];

  // ── Certificate columns ──────────────────────────────────────────────────────
  const certColumns = [
    { field: 'certificateNumber', headerName: 'Cert #', minWidth: 140,
      renderCell: (r) => <Typography variant="caption" fontFamily="monospace">{r.certificateNumber}</Typography> },
    { field: 'userName',     headerName: 'Employee', minWidth: 150 },
    { field: 'programCode',  headerName: 'Code',     minWidth: 100 },
    { field: 'programTitle', headerName: 'Program',  minWidth: 200 },
    { field: 'issuedDate',   headerName: 'Issued',   minWidth: 110, renderCell: (r) => formatDate(r.issuedDate) },
    { field: 'expiryDate',   headerName: 'Expires',  minWidth: 110,
      renderCell: (r) => (
        <Typography variant="caption" color={r.expired ? 'error.main' : 'text.primary'}>
          {formatDate(r.expiryDate) || '—'}
        </Typography>
      )},
    { field: 'scoreAchieved', headerName: 'Score', minWidth: 80, align: 'center',
      renderCell: (r) => r.scoreAchieved != null ? `${r.scoreAchieved.toFixed(0)}%` : '—' },
    { field: 'status', headerName: 'Status', minWidth: 100,
      renderCell: (r) => <Chip label={r.status} size="small" color={CERT_STATUS_COLORS[r.status] || 'default'} /> },
  ];

  const PROGRAM_STATUS_FILTER_OPTS    = ['', 'DRAFT','UNDER_REVIEW','APPROVED','PLANNED','ACTIVE','COMPLETED','REJECTED','ARCHIVED'];
  const ENROLLMENT_STATUS_FILTER_OPTS = ['', 'ALLOCATED','IN_PROGRESS','PENDING_REVIEW','PENDING_HR_REVIEW','PENDING_QA_APPROVAL','COMPLETED','FAILED','RETRAINING','EXPIRED','WAIVED','CANCELLED'];
  const COMPLIANCE_STATUS_FILTER_OPTS = ['PENDING_REVIEW','PENDING_HR_REVIEW','PENDING_QA_APPROVAL'];

  // tab 0=Programs, 1=Enrollments, 2=Compliance (pending), 3=Certificates
  const currentColumns = [programColumns, enrollmentColumns, enrollmentColumns, certColumns][tab] || programColumns;
  const currentRows    = [programRows, enrollmentRows, enrollmentRows, certRows][tab] || [];
  const statusOpts     = tab === 0
    ? PROGRAM_STATUS_FILTER_OPTS
    : tab === 2
      ? COMPLIANCE_STATUS_FILTER_OPTS
      : ENROLLMENT_STATUS_FILTER_OPTS;
  const statusLabelMap = tab === 0 ? PROGRAM_STATUS_LABELS : ENROLLMENT_STATUS_LABELS;

  return (
    <Box>
      <PageHeader
        title="Learning Management System"
        subtitle="Training Programs · Enrollments · Compliance · Certificates"
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'LMS' }]}
      />

      {/* Compliance Dashboard */}
      <LmsDashboard dash={dash} open={insightOpen} onToggle={() => setInsightOpen((p) => !p)} />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {TABS.map((t) => <Tab key={t.path} label={t.label} />)}
        </Tabs>
      </Box>

      {/* Filters + action button */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search…"
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {tab !== 3 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status"
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
              {tab !== 2 && <MenuItem value="">All Statuses</MenuItem>}
              {statusOpts.filter(Boolean).map((s) => (
                <MenuItem key={s} value={s}>{statusLabelMap[s] || s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Tooltip title="Refresh">
          <IconButton onClick={fetchTab}><RefreshIcon /></IconButton>
        </Tooltip>
        <Box sx={{ ml: 'auto' }}>
          {tab === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Create Program
            </Button>
          )}
          {tab === 2 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ComplianceIcon fontSize="small" /> Pending compliance reviews
            </Typography>
          )}
        </Box>
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchTab} />}

      <DataTable
        columns={currentColumns}
        rows={currentRows}
        loading={loading}
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
      />

      {/* Create Program Dialog */}
      <CreateProgramDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); fetchTab(); }}
      />

      {/* Program Detail Drawer */}
      <ProgramDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        programId={detailId}
        onUpdated={fetchTab}
      />

      {/* Enroll Dialog */}
      <EnrollDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => { setEnrollOpen(false); fetchTab(); }}
        programId={enrollProgram?.id}
        programTitle={enrollProgram?.title}
      />

      {/* Compliance Workflow Dialog */}
      <ComplianceDialog
        open={complianceOpen}
        onClose={() => setComplianceOpen(false)}
        enrollmentId={complianceEnrollId}
        onUpdated={fetchTab}
      />

      {/* Online MCQ Exam Dialog */}
      <ExamDialog
        open={examOpen}
        onClose={() => setExamOpen(false)}
        enrollmentId={examEnrollment?.id}
        programTitle={examEnrollment?.programTitle}
        onCompleted={fetchTab}
      />
    </Box>
  );
};

export default LmsPage;
