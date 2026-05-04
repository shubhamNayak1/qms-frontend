import React from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import {
  Check as CheckIcon,
  HourglassTop as InProgressIcon,
  RadioButtonUnchecked as PendingIcon,
  Cancel as TerminalIcon,
} from '@mui/icons-material';
import { getWorkflowStages } from './qmsConstants';

/**
 * Visual pipeline showing where a record is in its workflow.
 *
 * - Past stages   render in green with a check.
 * - Current stage renders highlighted (primary colour) with an hourglass.
 * - Future stages render greyed out.
 * - Optional branch stages are shown but lighter / italic so the eye
 *   knows they don't always apply.
 *
 * If the record is in a terminal state outside the canonical happy-path
 * (REJECTED, CANCELLED, REOPENED) we render a separate banner instead of
 * trying to position it in the pipeline.
 *
 * Props:
 *   moduleKey : qms module key (capa, deviation, incident, marketComplaint, changeControl)
 *   status    : current QmsStatus
 */
const TERMINAL_BANNERS = {
  REJECTED:  { label: 'Rejected — sent back to initiator',  color: 'error',   icon: <TerminalIcon /> },
  CANCELLED: { label: 'Cancelled',                          color: 'default', icon: <TerminalIcon /> },
  REOPENED:  { label: 'Reopened — back at Draft',           color: 'warning', icon: <InProgressIcon /> },
};

const WorkflowStageStepper = ({ moduleKey, status }) => {
  const stages = getWorkflowStages(moduleKey);
  if (!stages.length) return null;

  // Special non-canonical states
  if (TERMINAL_BANNERS[status]) {
    const t = TERMINAL_BANNERS[status];
    return (
      <Box sx={{ mb: 2 }}>
        <Chip icon={t.icon} label={t.label} color={t.color} />
      </Box>
    );
  }

  const currentIndex = stages.findIndex((s) => s.key === status);

  return (
    <Box sx={{
        display: 'flex', alignItems: 'flex-start', overflowX: 'auto', pb: 1,
        gap: 0.5, mb: 2, borderBottom: '1px solid', borderColor: 'divider',
      }}>
      {stages.map((stage, i) => {
        const past    = i < currentIndex;
        const current = i === currentIndex;
        const future  = i > currentIndex;

        const tone = past    ? 'success.main'
                  : current ? 'primary.main'
                  : 'text.disabled';
        const bg   = past    ? 'success.50'
                  : current ? 'primary.50'
                  : 'transparent';

        const Icon = past    ? CheckIcon
                  : current ? InProgressIcon
                  : PendingIcon;

        return (
          <React.Fragment key={stage.key}>
            <Tooltip title={`${stage.label} · ${stage.actor}${stage.optional ? ' (optional)' : ''}`}
                     arrow placement="top">
              <Box sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 88, py: 0.6, px: 0.4, borderRadius: 1.5,
                  bgcolor: bg, opacity: future && stage.optional ? 0.55 : 1,
                  flexShrink: 0,
                }}>
                <Box sx={{
                    width: 26, height: 26, borderRadius: '50%',
                    bgcolor: past ? 'success.main' : current ? 'primary.main' : 'grey.300',
                    color: past || current ? 'white' : 'text.secondary',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Icon sx={{ fontSize: 16 }} />
                </Box>
                <Typography variant="caption"
                            fontWeight={current ? 700 : 500}
                            sx={{ mt: 0.4, color: tone, lineHeight: 1.1, textAlign: 'center',
                                  fontStyle: stage.optional ? 'italic' : 'normal' }}>
                  {stage.label}
                </Typography>
                <Typography variant="caption"
                            sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1 }}>
                  {stage.actor}
                </Typography>
              </Box>
            </Tooltip>
            {i < stages.length - 1 && (
              <Box sx={{
                  alignSelf: 'center', flex: '0 0 14px', height: 2,
                  bgcolor: past ? 'success.light' : 'divider',
                  mt: '8px',
                }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default WorkflowStageStepper;
