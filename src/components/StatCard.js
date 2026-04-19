import React from 'react';
import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';

const StatCard = ({ title, value, subtitle, icon, color = 'primary.main', trend }) => (
  <Card>
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          {trend && (
            <Typography variant="caption" sx={{ color: trend > 0 ? 'success.main' : 'error.main', display: 'block', mt: 0.5 }}>
              {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% from last month
            </Typography>
          )}
        </Box>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
      </Box>
    </CardContent>
  </Card>
);

export default StatCard;
