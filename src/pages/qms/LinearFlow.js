import React from 'react';
import {
  Box, Typography, Stack, Chip, Paper, Divider, Alert, Grid, TextField,
} from '@mui/material';
import {
  CheckCircle as PastIcon,
  RadioButtonChecked as CurrentIcon,
  RemoveCircleOutline as SkippedIcon,
  Lock as TerminalIcon,
} from '@mui/icons-material';
import { formatDate, formatDateTimeAmPm } from '../../utils/helpers';
import QmsLineItemsSection from './QmsLineItemsSection';

/**
 * LinearFlow — shared building blocks for the Round-4 linear-stage layout.
 *
 * Every QMS module's stage panel renders its workflow as a vertical list of
 * sections, one per canonical stage:
 *
 *   ┌─ Draft ────────────────────── filled by alice · 21/06/2026 ────────┐
 *   │ (read-only summary of what the Initiator captured)                  │
 *   └─────────────────────────────────────────────────────────────────────┘
 *   ┌─ HOD Assessment ──────────── filled by bob · 22/06/2026 ───────────┐
 *   │ (read-only summary of the HOD's Initial Assessment)                 │
 *   └─────────────────────────────────────────────────────────────────────┘
 *   ┌─ QA Evaluation — Pre-Remark ─ filled by carla · 22/06/2026 ────────┐
 *   │ (read-only)                                                         │
 *   └─────────────────────────────────────────────────────────────────────┘
 *   ┌─ Site Head Concurrence ────── SKIPPED (Site Head Required = NO) ───┐
 *   │ (small badge, no body)                                              │
 *   └─────────────────────────────────────────────────────────────────────┘
 *   ┌─ Department Attachments ─── current stage ─────────────────────────┐
 *   │ (the editable form)                                                 │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 *   FUTURE stages (Verification, Closed in the example above) are NOT
 *   rendered — they only appear once the workflow reaches them.
 *
 *   A sticky action bar at the bottom of the drawer carries the current
 *   stage's buttons (Approve / Reject / Resend / etc.).
 *
 * State buckets a stage can be in:
 *   • 'past'    — finished. read-only view + actor stamp.
 *   • 'current' — being filled now. editable view + actor stamp.
 *   • 'skipped' — optional stage that was skipped. badge with reason.
 *   • 'future'  — not yet reached. NOT rendered.
 *   • 'terminal'— CLOSED / CANCELLED etc. read-only with lock icon.
 */

// ── SectionStamp ─────────────────────────────────────────────
// Compact "by X · on DD/MM/YYYY : HH:MM AM/PM" line. Used by every stage
// section to surface WHO filled the stage and WHEN.
//
// Round-L (2026-06-27): the timestamp now includes time-of-day in 12-hour
// IST so the audit trail surfaces when each transition actually happened,
// not just the day.
export const SectionStamp = ({ actor, when, label = 'by' }) => {
  if (!actor && !when) return null;
  const formatted = when ? formatDateTimeAmPm(when) : null;
  return (
    <Typography variant="caption" color="text.secondary">
      {label} <strong>{actor || '—'}</strong>{formatted ? ` · on ${formatted}` : ''}
    </Typography>
  );
};

// ── InitiatorSubmissionView ───────────────────────────────────
// Round-L (2026-06-27): every module's panel needs to surface the
// Initiator-captured fields at the Initiation (DRAFT) and Peer Review
// (PENDING_REVIEW) stages — otherwise the editor + the peer reviewer
// stare at a blank form because the workflow fields all live on
// downstream stages.
//
// Renders a compact info Alert + a grid of common fields + the
// QmsLineItemsSection. Per-module extras (e.g. CC's Product/Material,
// CAPA's source-record link) are passed via the `extras` prop as an
// array of {label, value} pairs and rendered alongside the common
// fields.
//
// Props:
//   record     : record DTO (must have id + the common QmsRecord fields)
//   commonSlug : kebab-case backend recordType for QmsLineItemsSection
//                (capa | deviation | incident | change-control | market-complaint)
//   extras     : optional [{label, value}, …] for per-module specifics
//   showLineItems : default true; pass false if the module doesn't use them
export const InitiatorSubmissionView = ({
  record,
  commonSlug,
  extras = [],
  showLineItems = true,
  // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: optional
  // edit mode used by the four QMS modules that lack a per-module
  // Draft editor of their own. When editable=true, the caller supplies
  // `form` + `setForm` for controlled state and `editableFields`
  // describing the schema. Fields not in the schema still render as
  // read-only rows via the `extras` list.
  //
  // Schema entry shape:
  //   { key, label, type: 'text'|'textarea'|'select'|'date',
  //     options?: string[], xs?: number, required?: boolean }
  editable = false,
  form,
  setForm,
  editableFields = [],
  isResend = false,
}) => {
  if (!record) return null;
  const dash = (v) => (v == null || v === '' ? '—' : v);
  // Round-L (2026-06-27): hide the helper banner once the record has
  // advanced past Peer Review — at HOD Assessment or later the
  // instruction is stale and the past-section is just a reference.
  const showHelperBanner = record?.status === 'DRAFT' || record?.status === 'PENDING_REVIEW';
  const setField = (k) => (e) => setForm?.((f) => ({ ...f, [k]: e.target.value }));
  return (
    <>
      {showHelperBanner && !editable && (
        <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.6 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            <strong>The fields below were captured by the Initiator on the Create dialog.</strong>
            {' '}Verify them, then write your <em>Remark / Justification</em> below before forwarding.
          </Typography>
        </Alert>
      )}
      {editable && (
        <Alert severity={isResend ? 'warning' : 'info'} icon={false}
               sx={{ mb: 1.5, py: 0.6 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {isResend
              ? <><strong>Record was sent back for edits.</strong>{' '}
                  Update the fields below, then click <em>Save Draft</em>{' '}
                  to persist changes or <em>Submit for Review</em> to
                  forward the corrected record.</>
              : <><strong>Initiator draft — every field below is editable.</strong>{' '}
                  Save Draft to keep working; Submit for Review to
                  forward to a peer reviewer in your department.</>}
          </Typography>
        </Alert>
      )}
      {editable ? (
        <Grid container spacing={1.4}>
          {/* Always-read-only header row so the Initiator sees the
              generated record number + who/when/where alongside the
              editable inputs. */}
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ pt: 0.4 }}>
              <strong>Record No.:</strong> {dash(record.recordNumber)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ pt: 0.4 }}>
              <strong>Raised By:</strong> {dash(record.raisedByName || record.createdBy)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ pt: 0.4 }}>
              <strong>Raised On:</strong> {record.createdAt ? formatDate(record.createdAt) : '—'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ pt: 0.4 }}>
              <strong>Department:</strong> {dash(record.department)}
            </Typography>
          </Grid>

          {editableFields.map((f) => (
            <Grid item xs={f.xs ?? 6} key={f.key}>
              {f.type === 'select' ? (
                <TextField
                  label={f.label} select fullWidth size="small"
                  required={!!f.required}
                  value={form?.[f.key] ?? ''} onChange={setField(f.key)}
                  SelectProps={{ native: true }}
                  inputProps={{ autoComplete: 'off' }}>
                  <option value=""></option>
                  {(f.options || []).map((o) =>
                    <option key={o} value={o}>{o}</option>)}
                </TextField>
              ) : f.type === 'date' ? (
                <TextField
                  label={f.label} type="date" fullWidth size="small"
                  required={!!f.required}
                  value={form?.[f.key] ?? ''} onChange={setField(f.key)}
                  InputLabelProps={{ shrink: true }}
                  helperText="DD/MM/YYYY"
                  inputProps={{ autoComplete: 'off' }} />
              ) : (
                <TextField
                  label={f.label} fullWidth size="small"
                  required={!!f.required}
                  multiline={f.type === 'textarea'}
                  minRows={f.type === 'textarea' ? 2 : undefined}
                  value={form?.[f.key] ?? ''} onChange={setField(f.key)}
                  inputProps={{ autoComplete: 'off' }} />
              )}
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={1.2}>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>Title:</strong> {dash(record.title)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>Record No.:</strong> {dash(record.recordNumber)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>Raised By:</strong> {dash(record.raisedByName || record.createdBy)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>Raised On:</strong> {record.createdAt ? formatDate(record.createdAt) : '—'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>Department:</strong> {dash(record.department)}</Typography>
          </Grid>
          {extras.filter(e => e && e.label).map((e, i) => (
            <Grid item xs={6} key={`extra-${i}`}>
              <Typography variant="body2"><strong>{e.label}:</strong> {dash(e.value)}</Typography>
            </Grid>
          ))}
          {record.description && (
            <Grid item xs={12}>
              <Typography variant="body2"><strong>Description:</strong></Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.description}</Typography>
            </Grid>
          )}
        </Grid>
      )}
      {showLineItems && record?.id && (
        <Box sx={{ mt: 1.8 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4, mb: 0.5, color: 'text.secondary' }}>
            LINE ITEMS
          </Typography>
          <QmsLineItemsSection
            commonSlug={commonSlug}
            recordId={record.id}
            readOnly={!editable}
          />
        </Box>
      )}
    </>
  );
};

// ── findStageActor ───────────────────────────────────────────
// Look up the StatusHistory entry that terminated a given source status
// (e.g. "the row where fromStatus === PENDING_HOD" = HOD's signoff).
//
// fromStatuses : array of QmsStatus strings to match against history.fromStatus
// toStatuses   : optional — narrow by destination too (useful for QA Ph2 vs Ph1)
//
// Returns { actor, when } or null.
export const findStageActor = (history, fromStatuses, toStatuses = null) => {
  if (!Array.isArray(history) || history.length === 0) return null;
  // walk most-recent → first; return the first match.
  for (const h of [...history].reverse()) {
    if (!fromStatuses.includes(h.fromStatus)) continue;
    if (toStatuses && !toStatuses.includes(h.toStatus)) continue;
    return {
      actor:   h.changedByUsername || h.actor,
      when:    h.changedAt || h.timestamp,
      // Round-5 H5 — surface the transition remark too so each past
      // StageSection can show "Remark: …" alongside the actor stamp.
      comment: h.comment,
    };
  }
  return null;
};

// ── StageSection ─────────────────────────────────────────────
// One stage in the linear flow. Renders a card with title, stamp/badge,
// and body. The body is supplied by the caller and is either the read-only
// data summary (for past stages) or the editable form (for current).
//
// Props
//   title        — e.g. "HOD Assessment"
//   state        — 'past' | 'current' | 'skipped' | 'terminal'
//   actor / when — for past/current/terminal — shown via SectionStamp
//   skippedReason— for state='skipped' (e.g. "Site Head Required = NO")
//   children     — body JSX
//   anchorId     — optional element id for "jump to stage" links
export const StageSection = ({
  title, state = 'past', actor, when,
  skippedReason, children, anchorId,
}) => {
  const isCurrent = state === 'current';
  const isPast    = state === 'past';
  const isSkipped = state === 'skipped';
  const isTerminal = state === 'terminal';

  const borderColor = isCurrent ? 'primary.main'
                    : isSkipped  ? 'grey.300'
                    : isTerminal ? 'success.main'
                    : 'divider';
  const Icon = isCurrent ? CurrentIcon
             : isSkipped  ? SkippedIcon
             : isTerminal ? TerminalIcon
             : PastIcon;
  const iconColor = isCurrent ? 'primary' : isSkipped ? 'disabled' : 'success';

  return (
    <Paper
      id={anchorId}
      elevation={0}
      variant="outlined"
      sx={{
        p: 2, mb: 1.5,
        borderLeft: '4px solid', borderLeftColor: borderColor, borderRadius: 1.5,
        bgcolor: isSkipped ? 'grey.50' : 'background.paper',
        opacity: isSkipped ? 0.78 : 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ mb: isSkipped ? 0 : 1 }}>
        <Icon fontSize="small" color={iconColor} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 0 }}>
          {title}
        </Typography>
        {isCurrent && <Chip size="small" color="primary" label="Current" />}
        {isSkipped && skippedReason && (
          <Chip size="small" variant="outlined" label={`Skipped — ${skippedReason}`} />
        )}
        <Box sx={{ flex: 1 }} />
        {(isPast || isCurrent || isTerminal) && (
          <SectionStamp actor={actor} when={when}
                        label={isCurrent ? 'now with' : isTerminal ? 'closed by' : 'filled by'} />
        )}
      </Stack>
      {!isSkipped && children && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          {children}
        </>
      )}
    </Paper>
  );
};

// ── StickyActionBar ─────────────────────────────────────────
// Fixed-position action bar at the bottom of the drawer. Holds the
// current stage's buttons (Approve / Resend / Reject / etc.).
//
// Props
//   children — Button elements
//   helperText — optional small status line above the buttons
export const StickyActionBar = ({ children, helperText }) => (
  <Paper
    elevation={4}
    sx={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      px: 3,
      py: 1.5,
      borderTop: '1px solid',
      borderColor: 'divider',
      borderRadius: 0,
      bgcolor: 'background.paper',
    }}
  >
    {helperText && (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {helperText}
      </Typography>
    )}
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {children}
    </Stack>
  </Paper>
);

// ── stageState helper ────────────────────────────────────────
// Given an ordered list of stage keys (the canonical path) and the
// current record status, decide which bucket each stage is in.
//
//   currentStatus      : record.status
//   stageKey           : the stage we're labelling
//   canonicalOrder     : [...] of stage keys in order
//   skippedPredicate   : optional fn (record, stageKey) → boolean
//                         returns true when the stage was an optional
//                         branch that wasn't taken
//   terminalStatuses   : array of statuses meaning the workflow is
//                         finished (CLOSED, CANCELLED, REJECTED).
//                         For terminal records, every stage in the
//                         canonical path is 'past' except those marked
//                         skipped.
export const computeStageState = ({
  currentStatus, stageKey, canonicalOrder,
  skippedPredicate, terminalStatuses = ['CLOSED', 'CANCELLED', 'REJECTED', 'REOPENED'],
}) => {
  if (skippedPredicate && skippedPredicate(stageKey)) return 'skipped';
  if (terminalStatuses.includes(currentStatus) && stageKey === currentStatus) return 'terminal';

  const currentIdx = canonicalOrder.indexOf(currentStatus);
  const stageIdx   = canonicalOrder.indexOf(stageKey);
  if (currentIdx < 0 || stageIdx < 0) return 'future';
  if (stageIdx < currentIdx) return 'past';
  if (stageIdx === currentIdx) return 'current';
  return 'future';
};
