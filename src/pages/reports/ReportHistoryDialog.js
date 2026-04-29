import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle  as DoneIcon,
  Cancel       as FailIcon,
  HourglassTop as PendingIcon,
  Sync         as RunningIcon,
  Person       as UserIcon,
  Schedule     as TimeIcon,
  TableRows    as RowsIcon,
} from '@mui/icons-material';
import { getReportHistoryApi } from '../../api/reportsApi';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtDuration = (ms) => {
  if (ms == null) return '—';
  if (ms < 1000)  return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};

const STATUS_META = {
  COMPLETED: { color: 'success', Icon: DoneIcon,    label: 'Completed' },
  FAILED:    { color: 'error',   Icon: FailIcon,    label: 'Failed'    },
  RUNNING:   { color: 'info',    Icon: RunningIcon, label: 'Running'   },
  PENDING:   { color: 'default', Icon: PendingIcon, label: 'Pending'   },
};

// ── History Entry ─────────────────────────────────────────────────────────
const HistoryEntry = ({ run, isLast }) => {
  const meta   = STATUS_META[run.status] || STATUS_META.PENDING;
  const { Icon, color, label } = meta;

  return (
    <Box sx={{ display: 'flex', gap: 2, pb: isLast ? 0 : 2.5 }}>
      {/* Timeline spine */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <Icon color={color} sx={{ fontSize: 22 }} />
        {!isLast && (
          <Box sx={{ width: '2px', flex: 1, bgcolor: 'divider', mt: 0.5, mb: 0, minHeight: 20 }} />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, pb: isLast ? 0 : 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={label}
            size="small"
            color={color}
            variant="filled"
          />
          <Typography variant="caption" color="text.secondary">
            Run #{run.id}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: run.errorMessage ? 1 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {fmtDate(run.startedAt)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <UserIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {run.triggeredByUsername || '—'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Duration: {fmtDuration(run.durationMs)}
            </Typography>
          </Box>
          {run.rowCount != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <RowsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {run.rowCount.toLocaleString()} rows
              </Typography>
            </Box>
          )}
          {run.fileSizeBytes != null && run.status === 'COMPLETED' && (
            <Typography variant="caption" color="text.secondary">
              {(run.fileSizeBytes / 1024).toFixed(1)} KB
            </Typography>
          )}
        </Box>

        {run.errorMessage && (
          <Box sx={{ mt: 0.75, p: 1, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.200' }}>
            <Typography variant="caption" color="error.dark" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {run.errorMessage}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ── Main Dialog ────────────────────────────────────────────────────────────
const ReportHistoryDialog = ({ open, onClose, report }) => {
  const [runs,    setRuns]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!open || !report?.id) return;
    setRuns([]);
    setPage(0);
    loadHistory(report.id, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report?.id]);

  const loadHistory = async (id, pageNum, reset = false) => {
    setLoading(true);
    try {
      const res     = await getReportHistoryApi(id, { page: pageNum, size: 15 });
      const content = res.data?.data?.content || [];
      const total   = res.data?.data?.totalElements ?? 0;
      setRuns((prev) => reset ? content : [...prev, ...content]);
      setHasMore((pageNum + 1) * 15 < total);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadHistory(report.id, next);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Run History
        {report && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {report.name}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {loading && runs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : runs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No run history found.
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Showing {runs.length} run{runs.length !== 1 ? 's' : ''} — most recent first
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {runs.map((run, i) => (
              <HistoryEntry key={run.id} run={run} isLast={i === runs.length - 1 && !hasMore} />
            ))}
            {hasMore && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={14} /> : null}
                >
                  Load more
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportHistoryDialog;
