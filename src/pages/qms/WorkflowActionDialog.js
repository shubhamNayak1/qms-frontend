import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Chip,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Send as SubmitIcon,
  Lock as CloseIcon,
} from '@mui/icons-material';

const ACTION_META = {
  submit:   { label: 'Submit for Review',    icon: <SubmitIcon />,  color: 'primary',   requireComment: false },
  approve:  { label: 'Approve / Forward',    icon: <ApproveIcon />, color: 'success',   requireComment: false },
  close:    { label: 'Close Record',         icon: <CloseIcon />,   color: 'success',   requireComment: false },
  reject:   { label: 'Reject / Send Back',   icon: <RejectIcon />,  color: 'error',     requireComment: true  },
  cancel:   { label: 'Cancel Record',        icon: <RejectIcon />,  color: 'error',     requireComment: true  },
  reopen:   { label: 'Reopen Record',        icon: <SubmitIcon />,  color: 'warning',   requireComment: false },
  transition: { label: 'Transition',         icon: <ApproveIcon />, color: 'primary',   requireComment: false },
};

/**
 * Props:
 *   open           boolean
 *   onClose        () => void
 *   onConfirm      (comment: string) => Promise<void>
 *   action         'submit' | 'approve' | 'close' | 'reject' | 'cancel' | 'reopen' | 'transition'
 *   actionLabel    override the button label (e.g. "Route to Site Head")
 *   recordTitle    shown in the dialog for context
 */
const WorkflowActionDialog = ({ open, onClose, onConfirm, action, actionLabel, recordTitle }) => {
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (open) { setComment(''); setError(null); }
  }, [open]);

  const meta          = ACTION_META[action] || ACTION_META.approve;
  const label         = actionLabel || meta.label;
  const needsComment  = meta.requireComment;

  const handleConfirm = async () => {
    if (needsComment && !comment.trim()) {
      setError('A comment is required for this action.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(comment.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {meta.icon}
          {label}
        </Box>
      </DialogTitle>
      <DialogContent>
        {recordTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Record: <strong>{recordTitle}</strong>
          </Typography>
        )}
        {error && (
          <Chip label={error} color="error" size="small" sx={{ mb: 1.5, maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
        )}
        <TextField
          label={needsComment ? 'Comment (required)' : 'Comment (optional)'}
          multiline
          rows={3}
          fullWidth
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment for the workflow history…"
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          color={meta.color}
          onClick={handleConfirm}
          disabled={loading || (needsComment && !comment.trim())}
        >
          {loading ? 'Processing…' : label}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowActionDialog;
