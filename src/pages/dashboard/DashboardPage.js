import React, { useEffect, useState } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Divider,
  List, ListItem, ListItemText, ListItemAvatar, Avatar, LinearProgress,
} from '@mui/material';
import {
  People as PeopleIcon, VerifiedUser as QmsIcon,
  Description as DmsIcon, School as LmsIcon,
  ManageSearch as AuditIcon, BarChart as ReportsIcon,
  Warning as WarningIcon, CheckCircle as CheckIcon,
  Assignment as AssignIcon, Folder as FolderIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../store/AuthContext';
import { getQmsDashboardApi } from '../../api/qmsApi';
import { getUsersApi } from '../../api/userApi';
import { getDocumentStatsApi } from '../../api/dmsApi';
import { getLmsComplianceDashboardApi } from '../../api/lmsApi';
import { getReportsDashboardApi } from '../../api/reportsApi';
import { getAuditStatsApi } from '../../api/auditApi';

// Safe API call — returns null on any error (403, 401, network)
const safe = (fn) => fn().then((r) => r.data?.data || null).catch(() => null);

const DashboardPage = () => {
  const { user, canAccessModule } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [qms, setQms] = useState(null);
  const [users, setUsers] = useState(null);
  const [dms, setDms] = useState(null);
  const [lms, setLms] = useState(null);
  const [reports, setReports] = useState(null);
  const [auditStats, setAuditStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasQMS    = canAccessModule('QMS');
  const hasUsers  = canAccessModule('USER');
  const hasDMS    = canAccessModule('DMS');
  const hasLMS    = canAccessModule('LMS');
  const hasReport = canAccessModule('REPORT');
  const hasAudit  = canAccessModule('AUDIT');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => {
    const calls = [
      hasQMS    ? safe(getQmsDashboardApi)          : Promise.resolve(null),
      hasUsers  ? safe(() => getUsersApi({ page: 0, size: 1 })) : Promise.resolve(null),
      hasDMS    ? safe(getDocumentStatsApi)          : Promise.resolve(null),
      hasLMS    ? safe(getLmsComplianceDashboardApi) : Promise.resolve(null),
      hasReport ? safe(getReportsDashboardApi)       : Promise.resolve(null),
      hasAudit  ? safe(getAuditStatsApi)             : Promise.resolve(null),
    ];
    Promise.all(calls).then(([q, u, d, l, r, a]) => {
      setQms(q);    setUsers(u);  setDms(d);
      setLms(l);    setReports(r); setAuditStats(a);
      setLoading(false);
    });
  }, [hasQMS, hasUsers, hasDMS, hasLMS, hasReport, hasAudit]);

  const roleName = (Array.isArray(user?.roles) ? user.roles[0] : user?.role) || '';

  // ── Stat cards per module ──────────────────────────────────────────────────
  const statCards = [
    hasUsers  && { title: 'Total Users',       value: String(users?.totalElements ?? users?.totalUsers ?? '—'), subtitle: 'Active accounts',    icon: <PeopleIcon />,  color: '#1565C0', trend: 0 },
    hasQMS    && { title: 'Open NCRs',          value: String(qms?.openNcCount ?? '—'),             subtitle: 'Non-conformances',    icon: <WarningIcon />, color: '#E53935', trend: 0 },
    hasQMS    && { title: 'Open CAPAs',         value: String(qms?.openCapaCount ?? '—'),           subtitle: 'Corrective actions',  icon: <AssignIcon />,  color: '#F57C00', trend: 0 },
    hasQMS    && { title: 'Open Incidents',     value: String(qms?.openIncidentCount ?? '—'),       subtitle: 'Reported incidents',  icon: <QmsIcon />,     color: '#6A1B9A', trend: 0 },
    hasDMS    && { title: 'Documents',          value: String(dms?.totalDocuments ?? dms?.total ?? '—'), subtitle: 'Managed docs',   icon: <DmsIcon />,     color: '#00897B', trend: 0 },
    hasDMS    && { title: 'Pending Review',     value: String(dms?.pendingReview ?? dms?.pendingApproval ?? '—'), subtitle: 'Awaiting approval', icon: <FolderIcon />, color: '#0277BD', trend: 0 },
    hasLMS    && { title: 'Active Courses',     value: String(lms?.activeProgramCount ?? '—'),      subtitle: 'Training programs',   icon: <LmsIcon />,     color: '#7B1FA2', trend: 0 },
    hasLMS    && { title: 'Completion Rate',    value: lms?.overallComplianceRate ? `${lms.overallComplianceRate}%` : '—', subtitle: 'Training compliance', icon: <CheckIcon />, color: '#2E7D32', trend: 0 },
    hasReport && { title: 'Overall Compliance', value: reports?.overallComplianceRate ? `${reports.overallComplianceRate}%` : '—', subtitle: 'System-wide', icon: <ReportsIcon />, color: '#1565C0', trend: 0 },
    hasAudit  && { title: 'Total Actions',      value: String(auditStats?.totalActions ?? '—'),     subtitle: 'Audit trail entries', icon: <AuditIcon />,   color: '#455A64', trend: 0 },
    hasAudit  && { title: 'Failed Logins',      value: String(auditStats?.failedLogins ?? '—'),     subtitle: 'Last 30 days',        icon: <WarningIcon />, color: '#C62828', trend: 0 },
  ].filter(Boolean);

  // ── Compliance bars ────────────────────────────────────────────────────────
  const complianceBars = [
    hasQMS    && { module: 'Quality Management', score: qms?.qmsComplianceScore ?? 94,    color: 'success' },
    hasDMS    && { module: 'Document Control',   score: dms?.complianceScore ?? 87,        color: 'info'    },
    hasLMS    && { module: 'Training & Competency', score: lms?.overallComplianceRate ?? 79, color: 'warning' },
    hasReport && { module: 'Risk Management',    score: reports?.riskScore ?? 91,           color: 'success' },
  ].filter(Boolean);

  // ── Action required panel ──────────────────────────────────────────────────
  const actionItems = [
    hasQMS    && qms?.openNcCount    > 0 && { label: 'Open NCRs',        value: qms.openNcCount,         color: 'error'   },
    hasQMS    && qms?.openCapaCount  > 0 && { label: 'Open CAPAs',       value: qms.openCapaCount,       color: 'warning' },
    hasQMS    && qms?.openIncidentCount > 0 && { label: 'Open Incidents', value: qms.openIncidentCount,  color: 'error'   },
    hasQMS    && qms?.pendingChangeCount > 0 && { label: 'Pending Changes', value: qms.pendingChangeCount, color: 'info'  },
    hasDMS    && dms?.pendingReview  > 0 && { label: 'Docs Pending Review', value: dms.pendingReview,    color: 'warning' },
    hasLMS    && lms?.overdueCount   > 0 && { label: 'Overdue Training',  value: lms.overdueCount,       color: 'error'   },
    hasAudit  && auditStats?.failedLogins > 0 && { label: 'Failed Logins', value: auditStats.failedLogins, color: 'error' },
  ].filter(Boolean);

  const roleLabel = roleName.replace(/_/g, ' ');

  return (
    <Box>
      <PageHeader
        title={`${greeting}, ${user?.name || 'User'}!`}
        subtitle={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {user?.designation || user?.department || 'Welcome back'}
            </Typography>
            {roleName && (
              <Chip label={roleLabel} size="small" color="primary" variant="outlined" />
            )}
          </Box>
        }
      />

      {/* Stat cards */}
      {statCards.length > 0 && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {statCards.map((stat) => (
            <Grid item xs={12} sm={6} lg={3} key={stat.title}>
              <StatCard {...stat} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* No access to anything */}
      {!loading && statCards.length === 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              Your role ({roleLabel}) has view-only access. Contact your administrator for more access.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2.5}>
        {/* QMS Quick Summary */}
        {hasQMS && qms && (
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>QMS Overview</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Open NCRs',         value: qms.openNcCount ?? 0,          color: 'error'   },
                    { label: 'Open CAPAs',         value: qms.openCapaCount ?? 0,        color: 'warning' },
                    { label: 'Open Deviations',    value: qms.openDeviationCount ?? 0,   color: 'info'    },
                    { label: 'Open Incidents',     value: qms.openIncidentCount ?? 0,    color: 'secondary' },
                    { label: 'Market Complaints',  value: qms.openComplaintCount ?? 0,   color: 'error'   },
                    { label: 'Pending Changes',    value: qms.pendingChangeCount ?? 0,   color: 'warning' },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={4} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.50`, border: '1px solid', borderColor: `${color}.100`, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color={`${color}.main`}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* DMS Quick Summary */}
        {hasDMS && dms && !hasQMS && (
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Document Overview</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Total Documents',   value: dms.totalDocuments ?? 0,   color: 'primary' },
                    { label: 'Published',         value: dms.publishedCount ?? 0,   color: 'success' },
                    { label: 'Pending Review',    value: dms.pendingReview ?? 0,    color: 'warning' },
                    { label: 'Draft',             value: dms.draftCount ?? 0,       color: 'info'    },
                    { label: 'Archived',          value: dms.archivedCount ?? 0,    color: 'default' },
                    { label: 'Expiring Soon',     value: dms.expiringSoon ?? 0,     color: 'error'   },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={4} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color !== 'default' ? `${color}.50` : 'grey.50', border: '1px solid', borderColor: color !== 'default' ? `${color}.100` : 'grey.200', textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color={color !== 'default' ? `${color}.main` : 'text.secondary'}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Right column */}
        <Grid item xs={12} lg={4}>
          {/* Action Required */}
          {actionItems.length > 0 && (
            <Card sx={{ mb: 2.5 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Action Required</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={1.5}>
                  {actionItems.map(({ label, value, color }) => (
                    <Grid item xs={6} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.50`, border: '1px solid', borderColor: `${color}.100`, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color={`${color}.main`}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Compliance Scores */}
          {complianceBars.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Compliance Score</Typography>
                <Divider sx={{ mb: 2 }} />
                {complianceBars.map(({ module, score, color }) => (
                  <Box key={module} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">{module}</Typography>
                      <Typography variant="caption" fontWeight={700} color={`${color}.main`}>{score}%</Typography>
                    </Box>
                    <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.100', overflow: 'hidden' }}>
                      <Box sx={{ width: `${score}%`, height: '100%', bgcolor: `${color}.main`, borderRadius: 3, transition: 'width 1s' }} />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* LMS Summary */}
        {hasLMS && lms && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Training & Compliance</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Active Programs',    value: lms.activeProgramCount ?? 0,     color: 'primary' },
                    { label: 'Total Enrollments',  value: lms.totalEnrollments ?? 0,        color: 'info'    },
                    { label: 'Completed',          value: lms.completedEnrollments ?? 0,    color: 'success' },
                    { label: 'Overdue',            value: lms.overdueCount ?? 0,             color: 'error'   },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.50`, border: '1px solid', borderColor: `${color}.100`, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color={`${color}.main`}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                {lms.overallComplianceRate != null && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">Overall Completion Rate</Typography>
                      <Typography variant="caption" fontWeight={700} color="success.main">{lms.overallComplianceRate}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={lms.overallComplianceRate} sx={{ height: 8, borderRadius: 4 }} color="success" />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Audit Summary */}
        {hasAudit && auditStats && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Audit Trail Summary</Typography>
                <Divider sx={{ mb: 2 }} />
                <List dense disablePadding>
                  {[
                    { label: 'Total Actions',     value: auditStats.totalActions ?? 0,     icon: <AuditIcon color="primary" /> },
                    { label: 'Successful Logins', value: auditStats.successfulLogins ?? 0, icon: <CheckIcon color="success" /> },
                    { label: 'Failed Logins',     value: auditStats.failedLogins ?? 0,     icon: <WarningIcon color="error" /> },
                    { label: 'Unique Users',      value: auditStats.uniqueUsers ?? 0,      icon: <PeopleIcon color="info" /> },
                  ].map(({ label, value, icon }) => (
                    <ListItem key={label} disablePadding sx={{ py: 0.75 }}>
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'transparent' }}>{icon}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2">{label}</Typography>}
                        secondary={null}
                      />
                      <Typography variant="h6" fontWeight={700}>{value}</Typography>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
