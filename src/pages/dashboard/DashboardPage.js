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
    hasUsers  && { title: 'Total Users',        value: String(users?.totalElements ?? users?.totalUsers ?? '—'), subtitle: 'Active accounts',    icon: <PeopleIcon />,  color: '#1565C0', trend: 0 },
    hasQMS    && { title: 'Open Records',        value: String(qms?.totalOpenRecords ?? '—'),        subtitle: 'All QMS modules',     icon: <QmsIcon />,     color: '#E53935', trend: 0 },
    hasQMS    && { title: 'Open CAPAs',          value: String(qms?.capaOpen ?? '—'),                subtitle: 'Corrective actions',  icon: <AssignIcon />,  color: '#F57C00', trend: 0 },
    hasQMS    && { title: 'Open Incidents',      value: String(qms?.incidentOpen ?? '—'),            subtitle: 'Reported incidents',  icon: <WarningIcon />, color: '#6A1B9A', trend: 0 },
    hasDMS    && { title: 'Documents',           value: String(dms?.totalCount ?? dms?.total ?? '—'), subtitle: 'Managed docs',  icon: <DmsIcon />,     color: '#00897B', trend: 0 },
    hasDMS    && { title: 'Pending Review',      value: String(dms?.underReviewCount ?? '—'), subtitle: 'Awaiting approval', icon: <FolderIcon />, color: '#0277BD', trend: 0 },
    hasLMS    && { title: 'Active Programs',     value: String(lms?.activePrograms ?? '—'),          subtitle: 'Training programs',   icon: <LmsIcon />,     color: '#7B1FA2', trend: 0 },
    hasLMS    && { title: 'Compliance Rate',     value: lms?.overallComplianceRate != null ? `${lms.overallComplianceRate.toFixed(1)}%` : '—', subtitle: 'Training compliance', icon: <CheckIcon />, color: '#2E7D32', trend: 0 },
    hasReport && { title: 'Overall Compliance',  value: reports?.overallComplianceRate ? `${reports.overallComplianceRate}%` : '—', subtitle: 'System-wide', icon: <ReportsIcon />, color: '#1565C0', trend: 0 },
    hasAudit  && { title: 'Total Actions',       value: String(auditStats?.totalActions ?? '—'),     subtitle: 'Audit trail entries', icon: <AuditIcon />,   color: '#455A64', trend: 0 },
    hasAudit  && { title: 'Failed Logins',       value: String(auditStats?.failedLogins ?? '—'),     subtitle: 'Last 30 days',        icon: <WarningIcon />, color: '#C62828', trend: 0 },
  ].filter(Boolean);

  // ── Action required panel ──────────────────────────────────────────────────
  const actionItems = [
    hasQMS    && (qms?.totalOverdueRecords ?? 0) > 0 && { label: 'Overdue Records',      value: qms.totalOverdueRecords,            color: 'error'   },
    hasQMS    && (qms?.capaOpen ?? 0)            > 0 && { label: 'Open CAPAs',           value: qms.capaOpen,                       color: 'warning' },
    hasQMS    && (qms?.incidentOpen ?? 0)        > 0 && { label: 'Open Incidents',       value: qms.incidentOpen,                   color: 'error'   },
    hasQMS    && (qms?.changeControlPendingApproval ?? 0) > 0 && { label: 'Pending Change Controls', value: qms.changeControlPendingApproval, color: 'info' },
    hasQMS    && (qms?.complaintReportableToAuthority ?? 0) > 0 && { label: 'Reportable Complaints', value: qms.complaintReportableToAuthority, color: 'error' },
    hasDMS    && (dms?.pendingReview ?? 0)       > 0 && { label: 'Docs Pending Review', value: dms.pendingReview,                  color: 'warning' },
    hasLMS    && (lms?.overdueCount ?? 0)        > 0 && { label: 'Overdue Training',    value: lms.overdueCount,                   color: 'error'   },
    hasAudit  && (auditStats?.failedLogins ?? 0) > 0 && { label: 'Failed Logins',       value: auditStats.failedLogins,            color: 'error'   },
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

      {/* ── ROW 1: Primary module overview + Action Required ── */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>

        {/* QMS Overview — full-featured module card */}
        {hasQMS && qms && (
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6">QMS Overview</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={`${qms.totalOpenRecords} Open`} size="small" color="warning" />
                    <Chip label={`${qms.totalOverdueRecords} Overdue`} size="small"
                      color={qms.totalOverdueRecords > 0 ? 'error' : 'default'} />
                  </Box>
                </Box>
                <Divider sx={{ mb: 1.5 }} />

                {/* Per-module rows */}
                {[
                  { label: 'CAPA',             color: '#7b1fa2',
                    items: [{ k: 'Open', v: qms.capaOpen }, { k: 'In Progress', v: qms.capaInProgress }, { k: 'Pending', v: qms.capaPendingApproval }, { k: 'Closed', v: qms.capaClosed }],
                    badges: [qms.capaOverdue > 0 && { label: `${qms.capaOverdue} Overdue`, bg: '#fdecea', fg: '#c62828' }, qms.capaCritical > 0 && { label: `${qms.capaCritical} Critical`, bg: '#fff3e0', fg: '#e65100' }].filter(Boolean) },
                  { label: 'Deviation',        color: '#1565c0',
                    items: [{ k: 'Open', v: qms.deviationOpen }, { k: 'In Progress', v: qms.deviationInProgress }, { k: 'Closed', v: qms.deviationClosed }],
                    badges: [qms.deviationOverdue > 0 && { label: `${qms.deviationOverdue} Overdue`, bg: '#fdecea', fg: '#c62828' }].filter(Boolean) },
                  { label: 'Incident',         color: '#c62828',
                    items: [{ k: 'Open', v: qms.incidentOpen }, { k: 'In Progress', v: qms.incidentInProgress }, { k: 'Closed', v: qms.incidentClosed }],
                    badges: [qms.incidentOverdue > 0 && { label: `${qms.incidentOverdue} Overdue`, bg: '#fdecea', fg: '#c62828' }, qms.incidentCriticalSeverity > 0 && { label: `${qms.incidentCriticalSeverity} Critical`, bg: '#fff3e0', fg: '#e65100' }].filter(Boolean) },
                  { label: 'Change Control',   color: '#2e7d32',
                    items: [{ k: 'Open', v: qms.changeControlOpen }, { k: 'Pending Approval', v: qms.changeControlPendingApproval }, { k: 'Closed', v: qms.changeControlClosed }],
                    badges: [qms.changeControlOverdue > 0 && { label: `${qms.changeControlOverdue} Overdue`, bg: '#fdecea', fg: '#c62828' }].filter(Boolean) },
                  { label: 'Market Complaint', color: '#e65100',
                    items: [{ k: 'Open', v: qms.complaintOpen }, { k: 'In Progress', v: qms.complaintInProgress }, { k: 'Closed', v: qms.complaintClosed }],
                    badges: [qms.complaintOverdue > 0 && { label: `${qms.complaintOverdue} Overdue`, bg: '#fdecea', fg: '#c62828' }, qms.complaintReportableToAuthority > 0 && { label: `${qms.complaintReportableToAuthority} Reportable`, bg: '#fce4ec', fg: '#880e4f' }].filter(Boolean) },
                ].map((mod) => (
                  <Box key={mod.label} sx={{ display: 'flex', alignItems: 'center', mb: 1,
                    borderLeft: `3px solid ${mod.color}`, pl: 1.5, py: 0.5,
                    borderRadius: '0 4px 4px 0', bgcolor: 'action.hover' }}>
                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 120, color: mod.color }}>
                      {mod.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flex: 1, gap: 2.5 }}>
                      {mod.items.map(({ k, v }) => (
                        <Box key={k} sx={{ textAlign: 'center', minWidth: 44 }}>
                          <Typography variant="body2" fontWeight={800} color={v > 0 ? 'text.primary' : 'text.disabled'}>{v ?? 0}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{k}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {mod.badges.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
                        {mod.badges.map((b) => (
                          <Box key={b.label} sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: b.bg }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: b.fg, fontSize: 10 }}>{b.label}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}

                {/* Status + Priority footer */}
                <Divider sx={{ my: 1.25 }} />
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, letterSpacing: 0.5 }}>STATUS</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {Object.entries(qms.statusBreakdown || {}).map(([k, v]) => (
                        <Box key={k} sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" fontWeight={700}>{v}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{k.replace(/_/g, ' ')}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, letterSpacing: 0.5 }}>PRIORITY</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {[{ k: 'CRITICAL', color: '#c62828' }, { k: 'HIGH', color: '#e65100' }, { k: 'MEDIUM', color: '#1976d2' }, { k: 'LOW', color: '#388e3c' }].map(({ k, color }) => (
                        <Box key={k} sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color }}>{qms.priorityBreakdown?.[k] ?? 0}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{k}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* DMS Overview — shown as primary card only when QMS not available */}
        {hasDMS && dms && !hasQMS && (
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Document Overview</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={1.5}>
                  {[
                    { label: 'Total Docs',     value: dms.totalCount ?? 0, color: 'primary' },
                    { label: 'Published',      value: dms.effectiveCount ?? 0, color: 'success' },
                    { label: 'Pending Review', value: dms.underReviewCount  ?? 0, color: 'warning' },
                    { label: 'Draft',          value: dms.draftCount     ?? 0, color: 'info'    },
                    { label: 'Archived',       value: dms.obsoleteCount  ?? 0, color: 'default' },
                    { label: 'Expiring Soon',  value: dms.expiringSoon?.length   ?? 0, color: 'error'   },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={4} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, textAlign: 'center',
                        bgcolor: color !== 'default' ? `${color}.50` : 'grey.50',
                        border: '1px solid', borderColor: color !== 'default' ? `${color}.100` : 'grey.200' }}>
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

        {/* Action Required — always visible, paired with the primary card */}
        <Grid item xs={12} lg={(hasQMS && qms) || (hasDMS && dms && !hasQMS) ? 4 : 12}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Action Required</Typography>
              <Divider sx={{ mb: 2 }} />
              {actionItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">All clear — no pending actions</Typography>
                </Box>
              ) : (
                <Grid container spacing={1.5}>
                  {actionItems.map(({ label, value, color }) => (
                    <Grid item xs={6} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: 2, textAlign: 'center',
                        bgcolor: `${color}.50`, border: '1px solid', borderColor: `${color}.100` }}>
                        <Typography variant="h5" fontWeight={700} color={`${color}.main`}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── ROW 2: DMS (if QMS shown) · Training & Compliance · Audit Trail ── */}
      {(() => {
        const row2 = [
          hasQMS && hasDMS && dms   && 'dms',
          hasLMS && lms             && 'lms',
          hasAudit && auditStats    && 'audit',
        ].filter(Boolean);
        if (row2.length === 0) return null;
        const md = row2.length === 3 ? 4 : row2.length === 2 ? 6 : 12;
        return (
          <Grid container spacing={2.5}>

            {/* DMS card — only in row 2 when QMS is also present */}
            {row2.includes('dms') && (
              <Grid item xs={12} md={md}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Document Overview</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Grid container spacing={1.25}>
                      {[
                        { label: 'Total Docs',     value: dms.totalCount ?? 0, color: 'primary' },
                        { label: 'Published',      value: dms.effectiveCount ?? 0, color: 'success' },
                        { label: 'Pending Review', value: dms.underReviewCount  ?? 0, color: 'warning' },
                        { label: 'Draft',          value: dms.draftCount     ?? 0, color: 'info'    },
                        { label: 'Archived',       value: dms.obsoleteCount  ?? 0, color: 'default' },
                        { label: 'Expiring Soon',  value: dms.expiringSoon?.length   ?? 0, color: 'error'   },
                      ].map(({ label, value, color }) => (
                        <Grid item xs={6} key={label}>
                          <Box sx={{ p: 1, borderRadius: 2, textAlign: 'center',
                            bgcolor: color !== 'default' ? `${color}.50` : 'grey.50',
                            border: '1px solid', borderColor: color !== 'default' ? `${color}.100` : 'grey.200' }}>
                            <Typography variant="h6" fontWeight={700} color={color !== 'default' ? `${color}.main` : 'text.secondary'}>{value}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Training & Compliance */}
            {row2.includes('lms') && (
              <Grid item xs={12} md={md}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Training &amp; Compliance</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Grid container spacing={1.25}>
                      {[
                        { label: 'Active Programs', value: lms.activePrograms    ?? 0, color: 'primary' },
                        { label: 'Mandatory',       value: lms.mandatoryPrograms ?? 0, color: 'warning' },
                        { label: 'Total Enrolled',  value: lms.totalEnrollments  ?? 0, color: 'info'    },
                        { label: 'In Progress',     value: lms.inProgressCount   ?? 0, color: 'info'    },
                        { label: 'Completed',       value: lms.completedCount    ?? 0, color: 'success' },
                        { label: 'Overdue',         value: lms.overdueCount      ?? 0, color: (lms.overdueCount ?? 0) > 0 ? 'error' : 'success' },
                      ].map(({ label, value, color }) => (
                        <Grid item xs={6} key={label}>
                          <Box sx={{ p: 1, borderRadius: 2, textAlign: 'center',
                            bgcolor: `${color}.50`, border: '1px solid', borderColor: `${color}.100` }}>
                            <Typography variant="h6" fontWeight={700} color={`${color}.main`}>{value}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    {lms.overallComplianceRate != null && (
                      <Box sx={{ mt: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Overall Compliance</Typography>
                          <Typography variant="caption" fontWeight={700}
                            color={lms.overallComplianceRate >= 80 ? 'success.main' : lms.overallComplianceRate >= 50 ? 'warning.main' : 'error.main'}>
                            {lms.overallComplianceRate.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={Math.min(lms.overallComplianceRate, 100)}
                          sx={{ height: 7, borderRadius: 4 }}
                          color={lms.overallComplianceRate >= 80 ? 'success' : lms.overallComplianceRate >= 50 ? 'warning' : 'error'} />
                      </Box>
                    )}
                    {lms.dueSoonEnrollments?.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary"
                          sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Due Soon ({lms.dueSoonEnrollments.length})
                        </Typography>
                        {lms.dueSoonEnrollments.slice(0, 3).map((e) => (
                          <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', py: 0.4, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                              {e.userName || `User #${e.userId}`} — {e.programCode || `#${e.programId}`}
                            </Typography>
                            <Chip label={e.dueDate} size="small" color="warning" variant="outlined"
                              sx={{ fontSize: 10, height: 18, ml: 1, flexShrink: 0 }} />
                          </Box>
                        ))}
                        {lms.dueSoonEnrollments.length > 3 && (
                          <Typography variant="caption" color="text.secondary">+{lms.dueSoonEnrollments.length - 3} more</Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Audit Trail */}
            {row2.includes('audit') && (
              <Grid item xs={12} md={md}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Audit Trail</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <List dense disablePadding>
                      {[
                        { label: 'Total Actions',     value: auditStats.totalActions     ?? 0, icon: <AuditIcon color="primary" /> },
                        { label: 'Successful Logins', value: auditStats.successfulLogins ?? 0, icon: <CheckIcon color="success" /> },
                        { label: 'Failed Logins',     value: auditStats.failedLogins     ?? 0, icon: <WarningIcon color="error" /> },
                        { label: 'Unique Users',      value: auditStats.uniqueUsers      ?? 0, icon: <PeopleIcon color="info" /> },
                      ].map(({ label, value, icon }) => (
                        <ListItem key={label} disablePadding sx={{ py: 0.75 }}>
                          <ListItemAvatar sx={{ minWidth: 36 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'transparent' }}>{icon}</Avatar>
                          </ListItemAvatar>
                          <ListItemText primary={<Typography variant="body2">{label}</Typography>} />
                          <Typography variant="h6" fontWeight={700}>{value}</Typography>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        );
      })()}
    </Box>
  );
};

export default DashboardPage;
