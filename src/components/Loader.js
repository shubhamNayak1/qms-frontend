import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const Loader = ({ message = 'Loading...' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
    <CircularProgress size={44} thickness={4} />
    <Typography variant="body2" color="text.secondary">{message}</Typography>
  </Box>
);

export default Loader;
