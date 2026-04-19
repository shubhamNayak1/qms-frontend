import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const PageHeader = ({ title, subtitle, breadcrumbs = [], action }) => (
  <Box sx={{ mb: 3 }}>
    {breadcrumbs.length > 0 && (
      <Breadcrumbs sx={{ mb: 0.5 }}>
        {breadcrumbs.map((crumb, i) =>
          crumb.href ? (
            <Link key={i} component={RouterLink} to={crumb.href} underline="hover" color="inherit" variant="caption">
              {crumb.label}
            </Link>
          ) : (
            <Typography key={i} variant="caption" color="text.primary">{crumb.label}</Typography>
          )
        )}
      </Breadcrumbs>
    )}
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{subtitle}</Typography>}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  </Box>
);

export default PageHeader;
