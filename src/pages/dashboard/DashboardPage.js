import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, Divider, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import {
  People as PeopleIcon,
  VerifiedUser as QmsIcon,
  Description as DmsIcon,
  School as LmsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../store/AuthContext';

const MOCK_STATS = [
  { title: 'Total Users', value: '248', subtitle: 'Active accounts', icon: <PeopleIcon />, color: '#1565C0', trend: 12 },
  { title: 'Non-Conformances', value: '34', subtitle: '8 open this week', icon: <QmsIcon />, color: '#E53935', trend: -5 },
  { title: 'Documents', value: '1,204', subtitle: '23 pending review', icon: <DmsIcon />, color: '#00897B', trend: 8 },
  { title: 'Training Courses', value: '47', subtitle: '312 enrollments', icon: <LmsIcon />, color: '#7B1FA2', trend: 15 },
];

const RECENT_ACTIVITY = [
  { id: 1, type: 'NC', title: 'Non-Conformance #NC-2024-089', desc: 'Product defect reported in Batch #4421', status: 'OPEN', time: '2 hours ago', color: 'error' },
  { id: 2, type: 'DOC', title: 'SOP-QC-023 Updated', desc: 'Quality Control Procedure v3.2 published', status: 'APPROVED', time: '4 hours ago', color: 'success' },
  { id: 3, type: 'LMS', title: 'ISO 9001 Training Completed', desc: '12 employees completed training module', status: 'COMPLETED', time: '1 day ago', color: 'success' },
  { id: 4, type: 'AUDIT', title: 'Internal Audit Scheduled', desc: 'Q4 Internal Audit — Production Floor', status: 'PENDING', time: '2 days ago', color: 'warning' },
  { id: 5, type: 'DOC', title: 'Risk Assessment Document', desc: 'Annual risk assessment submitted for review', status: 'PENDING', time: '3 days ago', color: 'warning' },
];

const QUICK_STATS = [
  { label: 'Open NCRs', value: 8, color: 'error' },
  { label: 'Docs Pending', value: 23, color: 'warning' },
  { label: 'Overdue Training', value: 5, color: 'error' },
  { label: 'Audits This Month', value: 3, color: 'info' },
];

const DashboardPage = () => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <Box>
      <PageHeader
        title={`${greeting}, ${user?.name || 'Admin'}!`}
        subtitle="Here's what's happening across your QMS today."
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {MOCK_STATS.map((stat) => (
          <Grid item xs={12} sm={6} lg={3} key={stat.title}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Recent Activity */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="h6" gutterBottom>Recent Activity</Typography>
              <Divider sx={{ mb: 1 }} />
              <List dense disablePadding>
                {RECENT_ACTIVITY.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `${item.color}.light`, color: `${item.color}.dark`, width: 36, height: 36, fontSize: 12 }}>
                          {item.type}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{item.title}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{item.desc} · {item.time}</Typography>}
                      />
                      <Chip label={item.status} color={item.color} size="small" variant="outlined" sx={{ ml: 1, minWidth: 80 }} />
                    </ListItem>
                    {idx < RECENT_ACTIVITY.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats panel */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Action Required</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {QUICK_STATS.map(({ label, value, color }) => (
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
              {[
                { module: 'Quality Management', score: 94, color: 'success' },
                { module: 'Document Control', score: 87, color: 'info' },
                { module: 'Training & Competency', score: 79, color: 'warning' },
                { module: 'Risk Management', score: 91, color: 'success' },
              ].map(({ module, score, color }) => (
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
