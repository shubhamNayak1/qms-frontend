import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, Divider, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import {
  People as PeopleIcon,
  VerifiedUser as QmsIcon,
  Description as DmsIcon,
  School as LmsIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../store/AuthContext';
import { getQmsDashboardApi } from '../../api/qmsApi';
import { getUsersApi } from '../../api/userApi';
import { getDocumentStatsApi } from '../../api/dmsApi';
import { getLmsComplianceDashboardApi } from '../../api/lmsApi';

const FALLBACK_STATS = [
  { title: 'Total Users', value: '—', subtitle: 'Active accounts', icon: <PeopleIcon />, color: '#1565C0', trend: 0 },
  { title: 'Non-Conformances', value: '—', subtitle: 'Open items', icon: <QmsIcon />, color: '#E53935', trend: 0 },
  { title: 'Documents', value: '—', subtitle: 'Managed docs', icon: <DmsIcon />, color: '#00897B', trend: 0 },
  { title: 'Training Courses', value: '—', subtitle: 'Active courses', icon: <LmsIcon />, color: '#7B1FA2', trend: 0 },
];

const DashboardPage = () => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [qmsDash, setQmsDash] = useState(null);
  const [lmsDash, setLmsDash] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([
        getQmsDashboardApi(),
        getUsersApi({ page: 0, size: 1 }),
        getDocumentStatsApi(),
        getLmsComplianceDashboardApi(),
      ]);

      const qmsData = results[0].status === 'fulfilled' ? results[0].value.data?.data : null;
      const usersData = results[1].status === 'fulfilled' ? results[1].value.data?.data : null;
      const dmsData = results[2].status === 'fulfilled' ? results[2].value.data?.data : null;
      const lmsData = results[3].status === 'fulfilled' ? results[3].value.data?.data : null;

      if (qmsData) setQmsDash(qmsData);
      if (lmsData) setLmsDash(lmsData);

      const totalUsers = usersData?.totalElements ?? usersData?.totalUsers ?? '—';
      const totalDocs = dmsData?.totalDocuments ?? dmsData?.total ?? '—';
      const openNc = qmsData?.openNcCount ?? qmsData?.openNonConformances ?? '—';
      const totalCourses = lmsData?.activeProgramCount ?? lmsData?.totalPrograms ?? '—';

      setStats([
        { title: 'Total Users', value: String(totalUsers), subtitle: 'Active accounts', icon: <PeopleIcon />, color: '#1565C0', trend: 0 },
        { title: 'Non-Conformances', value: String(openNc), subtitle: 'Open this period', icon: <QmsIcon />, color: '#E53935', trend: 0 },
        { title: 'Documents', value: String(totalDocs), subtitle: 'Managed docs', icon: <DmsIcon />, color: '#00897B', trend: 0 },
        { title: 'Training Courses', value: String(totalCourses), subtitle: 'Active courses', icon: <LmsIcon />, color: '#7B1FA2', trend: 0 },
      ]);

      if (qmsData?.recentActivity) {
        setRecentActivity(qmsData.recentActivity.slice(0, 5).map((a, i) => ({
          id: i,
          type: a.module?.substring(0, 3) || 'QMS',
          title: a.title || a.action || 'Activity',
          desc: a.description || '',
          status: a.status || 'INFO',
          time: a.timestamp ? new Date(a.timestamp).toLocaleDateString() : '',
          color: 'info',
        })));
      }
    };
    load();
  }, []);

  const d = qmsDash;
  const quickStats = [
    { label: 'Open NCRs', value: d?.openNcCount ?? '—', color: 'error' },
    { label: 'Open CAPAs', value: d?.openCapaCount ?? '—', color: 'warning' },
    { label: 'Open Incidents', value: d?.openIncidentCount ?? '—', color: 'error' },
    { label: 'Pending Changes', value: d?.pendingChangeCount ?? '—', color: 'info' },
  ];

  const complianceScores = [
    { module: 'Quality Management', score: d?.qmsComplianceScore ?? 94, color: 'success' },
    { module: 'Document Control', score: lmsDash?.documentComplianceScore ?? 87, color: 'info' },
    { module: 'Training & Competency', score: lmsDash?.overallComplianceRate ?? 79, color: 'warning' },
    { module: 'Risk Management', score: d?.riskScore ?? 91, color: 'success' },
  ];

  const displayActivity = recentActivity.length > 0 ? recentActivity : [
    { id: 1, type: 'SYS', title: 'Dashboard loaded', desc: 'Connect your backend to see live activity', status: 'INFO', time: 'now', color: 'info' },
  ];

  return (
    <Box>
      <PageHeader
        title={`${greeting}, ${user?.name || 'Admin'}!`}
        subtitle="Here's what's happening across your QMS today."
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} lg={3} key={stat.title}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="h6" gutterBottom>Recent Activity</Typography>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding>
                {displayActivity.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `${item.color}.light`, color: `${item.color}.dark`, width: 36, height: 36, fontSize: 12 }}>
                          {item.type}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{item.title}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{item.desc}{item.time ? ` · ${item.time}` : ''}</Typography>}
                      />
                      <Chip label={item.status} color={item.color} size="small" variant="outlined" sx={{ ml: 1, minWidth: 80 }} />
                    </ListItem>
                    {idx < displayActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Action Required</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {quickStats.map(({ label, value, color }) => (
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

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Compliance Score</Typography>
              <Divider sx={{ mb: 2 }} />
              {complianceScores.map(({ module, score, color }) => (
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
