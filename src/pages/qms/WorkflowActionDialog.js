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
import ESignDialog from '../../components/ESignDialog';

// Per 21 CFR Part 11 / GxP — every workflow action MUST carry a non-blank
// comment so the audit trail records an intelligible reason for the change.
const ACTION_META = {
  submit:   { label: 'Submit for Review',    icon: <SubmitIcon />,  color: 'primary',   requireComment: true },
  approve:  { label: 'Approve / Forward',    icon: <ApproveIcon />, color: 'success',   requireComment: true },
  close:    { label: 'Close Record',         icon: <CloseIcon />,   color: 'success',   requireComment: true },
  reject:   { label: 'Reject / Send Back',   icon: <RejectIcon />,  color: 'error',     requireComment: true },
  cancel:   { label: 'Cancel Record',        icon: <RejectIcon />,  color: 'error',     requireComment: true },
  reopen:   { label: 'Reopen Record',        icon: <SubmitIcon />,  color: 'warning',   requireComment: true },
  transition: { label: 'Transition',         icon: <ApproveIcon />, color: 'primary',   requireComment: true },
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
  // Round-2 E3: every workflow transition is e-signed. We open the e-sign
  // modal after the user has typed their comment and hit the action button.
  // The actual onConfirm() call happens only after the server verifies the
  // signature.
  const [eSignOpen, setESignOpen] = useState(false);

  useEffect(() => {
    if (open) { setComment(''); setError(null); setESignOpen(false); }
  }, [open]);

  const meta          = ACTION_META[action] || ACTION_META.approve;
  const label         = actionLabel || meta.label;
  const needsComment  = meta.requireComment;

  // Stage 1 — user clicked the action button: validate comment, then open e-sign
  const handleConfirm = () => {
    if (needsComment && !comment.trim()) {
      setError('A comment is required for this action.');
      return;
    }
    setError(null);
    setESignOpen(true);
  };

  // Stage 2 — e-sign succeeded: fire the actual workflow API
  const handleSigned = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(comment.trim() || undefined);
      setESignOpen(false);
      onClose();
    } catch (err) {
      setESignOpen(false);
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
          label="Comment"
          required
          multiline
          rows={3}
          fullWidth
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain the reason for this action — recorded in the audit trail."
          autoFocus
          inputProps={{ autoComplete: 'off' }}
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
          {loading ? 'Processing…' : `${label} (e-sign required)`}
        </Button>
      </DialogActions>

      {/* Round-2 E3 — 21 CFR Part 11 e-signature gate */}
      <ESignDialog
        open={eSignOpen}
        onClose={() => !loading && setESignOpen(false)}
        onSigned={handleSigned}
        meaning={`${label}${recordTitle ? ' — ' + recordTitle : ''}`}
        recordRef={recordTitle}
        actionLabel={loading ? 'Processing…' : label}
      />
    </Dialog>
  );
};

export default WorkflowActionDialog;
