import React from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';

const ErrorAlert = ({ message, onRetry }) => (
  <Box sx={{ my: 2 }}>
    <Alert severity="error" action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
      <AlertTitle>Error</AlertTitle>
      {message || 'An unexpected error occurred.'}
    </Alert>
  </Box>
);

export default ErrorAlert;
