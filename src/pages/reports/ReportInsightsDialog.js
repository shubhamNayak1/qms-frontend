import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Chip,
  Divider, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Alert,
} from '@mui/material';
import {
  TrendingUp   as UpIcon,
  TrendingDown as DownIcon,
  TrendingFlat as FlatIcon,
  Lightbulb    as InsightIcon,
  BarChart     as StatsIcon,
} from '@mui/icons-material';
import { getReportInsightsApi } from '../../api/reportsApi';

// ── Helpers ────────────────────────────────────────────────────────────────
const TREND_META = {
  INCREASING: { Icon: UpIcon,   color: 'error',   label: 'Trending Up',    bg: 'error.50' },
  DECREASING: { Icon: DownIcon, color: 'success',  label: 'Trending Down',  bg: 'success.50' },
  STABLE:     { Icon: FlatIcon, color: 'info',     label: 'Stable',         bg: 'info.50' },
};

const TrendBadge = ({ direction }) => {
  const meta = TREND_META[direction] || TREND_META.STABLE;
  const { Icon, color, label } = meta;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: '16px !important' }} />}
      label={label}
      color={color}
      size="small"
      variant="filled"
    />
  );
};

const StatChip = ({ name, stat }) => (
  <Box
    sx={{
      display: 'inline-flex', flexDirection: 'column',
      alignItems: 'center', p: 1.25, border: '1px solid',
      borderColor: 'divider', borderRadius: 1.5, minWidth: 90,
    }}
  >
    <Typography variant="caption" color="text.secondary" noWrap>{name}</Typography>
    <Typography variant="body2" fontWeight={700}>{stat.avg?.toFixed(1) ?? '—'}</Typography>
    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem' }}>
      {stat.min ?? '—'} – {stat.max ?? '—'}
    </Typography>
    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem' }}>
      avg · min – max
    </Typography>
  </Box>
);

// Derive table columns dynamically from topGroups keys
const groupColumns = (groups) => {
  if (!groups?.length) return [];
  return Object.keys(groups[0]);
};

// ── Main Dialog ────────────────────────────────────────────────────────────
const ReportInsightsDialog = ({ open, onClose, report }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!open || !report?.id) return;
    setData(null);
    setError(null);
    setLoading(true);
    getReportInsightsApi(report.id)
      .then((res) => setData(res.data?.data || null))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load insights.'))
      .finally(() => setLoading(false));
  }, [open, report?.id]);

  const topCols    = groupColumns(data?.topGroups);
  const bottomCols = groupColumns(data?.bottomGroups);
  const statEntries = data?.columnStats ? Object.entries(data.columnStats) : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Insights
        {report && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {report.name}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error">{error}</Alert>
        )}

        {!loading && data && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* ── Header row ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ px: 2, py: 1, bgcolor: 'primary.50', borderRadius: 1.5, textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {data.totalRows?.toLocaleString() ?? '—'}
                </Typography>
                <Typography variant="caption" color="primary.dark">Total Rows</Typography>
              </Box>
              {data.trendDirection && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Trend:</Typography>
                  <TrendBadge direction={data.trendDirection} />
                </Box>
              )}
            </Box>

            {/* ── Column Stats chips ── */}
            {statEntries.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                    <StatsIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" fontWeight={600}>Column Statistics</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {statEntries.map(([name, stat]) => (
                      <StatChip key={name} name={name} stat={stat} />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {/* ── Top groups table ── */}
            {data.topGroups?.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Top Groups
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {topCols.map((c) => (
                            <TableCell key={c} sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                              {c}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.topGroups.map((row, i) => (
                          <TableRow key={i} hover>
                            {topCols.map((c) => (
                              <TableCell key={c}>
                                {c === 'Count'
                                  ? <Typography variant="body2" fontWeight={700}>{row[c]}</Typography>
                                  : row[c]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </>
            )}

            {/* ── Bottom groups table ── */}
            {data.bottomGroups?.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Bottom Groups
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {bottomCols.map((c) => (
                            <TableCell key={c} sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                              {c}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.bottomGroups.map((row, i) => (
                          <TableRow key={i} hover>
                            {bottomCols.map((c) => (
                              <TableCell key={c}>{row[c]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </>
            )}

            {/* ── Insight cards ── */}
            {data.insights?.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                    <InsightIcon fontSize="small" color="warning" />
                    <Typography variant="subtitle2" fontWeight={600}>Key Insights</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data.insights.map((text, i) => (
                      <Box
                        key={i}
                        sx={{
                          p: 1.25, borderRadius: 1.5,
                          bgcolor: text.startsWith('⚠') ? 'warning.50' : 'grey.50',
                          border: '1px solid',
                          borderColor: text.startsWith('⚠') ? 'warning.200' : 'divider',
                        }}
                      >
                        <Typography variant="body2">{text}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportInsightsDialog;
