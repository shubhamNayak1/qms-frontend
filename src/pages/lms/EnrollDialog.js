import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, Typography, Box,
} from '@mui/material';
import { bulkEnrollApi } from '../../api/lmsApi';

const EnrollDialog = ({ open, onClose, onEnrolled, programId, programTitle }) => {
  const [userIds,   setUserIds]   = useState('');
  const [dueDate,   setDueDate]   = useState('');
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);

  const handleClose = () => { setUserIds(''); setDueDate(''); setReason(''); setError(null); onClose(); };

  const handleEnroll = async () => {
    const ids = userIds.split(/[\s,]+/).map(Number).filter(Boolean);
    if (!ids.length) { setError('Enter at least one User ID.'); return; }
    setSaving(true); setError(null);
    try {
      await bulkEnrollApi({ programId, userIds: ids, dueDate: dueDate || undefined, assignmentReason: reason || undefined });
      onEnrolled();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Enrollment failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Enroll Users</DialogTitle>
      <DialogContent dividers>
        {programTitle && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Program</Typography>
            <Typography variant="body2" fontWeight={600}>{programTitle}</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label="User IDs (comma or space separated)"
          fullWidth size="small" sx={{ mb: 2 }}
          value={userIds}
          onChange={(e) => setUserIds(e.target.value)}
          placeholder="101, 102, 103"
          helperText="Enter employee User IDs to enroll"
        />
        <TextField
          label="Due Date (optional)"
          type="date" fullWidth size="small" sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <TextField
          label="Assignment Reason (optional)"
          fullWidth size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Annual GMP refresh"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleEnroll} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}>
          {saving ? 'Enrolling…' : 'Enroll'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnrollDialog;
