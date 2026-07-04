import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Grid, TextField, MenuItem, Stack, Button,
  Alert, FormControlLabel, Switch, Tooltip, Chip, Box, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ESignDialog from '../../components/ESignDialog';
import StageAttachments from './StageAttachments';
import {
  Save as SaveIcon, ArrowForward as ForwardIcon, Cancel as RejectIcon,
  Undo as ResendIcon,
} from '@mui/icons-material';
import {
  updateChangeControlApi, approveChangeControlApi, rejectChangeControlApi,
  closeChangeControlApi, transitionChangeControlApi, submitChangeControlApi,
} from '../../api/qmsApi';
import { listDeptCommentsApi } from '../../api/qmsCommonApi';
import QmsDepartmentAttachmentsSection from './QmsDepartmentAttachmentsSection';
import QmsDepartmentCommentsSection from './QmsDepartmentCommentsSection';
import QmsLineItemsSection from './QmsLineItemsSection';
import { useAuth } from '../../store/AuthContext';
import { formatDate } from '../../utils/helpers';
import {
  StageSection, StickyActionBar, findStageActor as flowFindStageActor,
} from './LinearFlow';
// formatDateTime previously used by Activity History (removed in Round-3 R18).

/**
 * ChangeControlStagePanel — May 2026 tester rebuild.
 *
 * Notable per-stage rules from the tester walkthrough:
 *
 *   PENDING_HOD ("HOD Assessment")
 *     • Read-only context block listing EVERYTHING the Initiator entered
 *       (title, dept, dates, product name + code, change type, line items
 *       with Existing/Proposed/Justification, the Initiator's attachment).
 *     • HOD writes Initial Assessment (renamed from Risk Assessment).
 *     • Three buttons: Approve & forward to QA · Resend to Initiator · Reject.
 *       Resend bounces the record back to DRAFT and increments resend_count
 *       — distinct from Reject which terminates the record.
 *     • Linked CAPA is removed at this stage per tester feedback.
 *
 *   PENDING_QA_REVIEW ("QA Evaluation")
 *     • Two-phase form, same status:
 *         Phase 1 — no dept comments returned yet. QA captures CC Type
 *                   (= Risk Level, Critical/Major/Minor) + Pre-Remark
 *                   + invites departments. Save blocks until at least one
 *                   dept has been invited.
 *         Phase 2 — at least one dept comment has been COMPLETED. QA fills
 *                   QA Evaluation Remark + Risk Assessment Req/Not (with
 *                   conditional narrative) + Site Head Req + Customer
 *                   Communication Req + Regulatory Assessment Req.
 *     • The label "QA Evaluation" is used everywhere — no more "QA Review".
 *
 *   All other stages keep their existing fields but the audit-comment
 *   label is "Remark / Justification" everywhere.
 */

// ── Stage descriptors ───────────────────────────────────────────────
const STAGE_DESCRIPTORS = {
  // Round-5 I1: DRAFT now has a descriptor so the panel renders for the
  // Initiator. There are no editable fields here — the Initiator edits
  // line items / attachments via the linear-flow's inline sections.
  // The only action is Submit for Review.
  DRAFT: {
    title: 'Initiation',
    actor: 'Initiator',
    helper: 'Review what you captured below. When ready, click Submit for Review to forward the record to a peer reviewer in your department.',
    fields: [],
    requiredFields: [],
    primary: 'submit',
    primaryLabel: 'Submit for Review',
  },
  // Round-L (2026-06-26): peer-review gate. A different user in the
  // creator's department (flagged is_dept_reviewer) verifies the
  // captured fields, then forwards to HOD or sends back for edits.
  PENDING_REVIEW: {
    title: 'Peer Review',
    actor: 'Department Reviewer',
    helper: 'Verify the details captured by the Initiator below. Forward to HOD when correct, or send back to the Initiator for edits.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Submit to HOD',
    secondary: { kind: 'transition', target: 'DRAFT', label: 'Send back to Initiator' },
  },
  PENDING_HOD: {
    title: 'HOD Assessment',
    actor: 'Head of Department',
    helper: 'Review every field the Initiator captured below, then write your Initial Assessment. Three outcomes: forward to QA, send back to Initiator for revision, or reject.',
    fields: ['initialAssessment'],
    requiredFields: ['initialAssessment'],
    primary: 'approve',
    // Round-3 R10: HOD button reads "Review & forward to QA" — HOD is
    // performing the review, not approving the change itself.
    primaryLabel: 'Review & forward to QA Evaluation',
  },
  PENDING_QA_REVIEW: {
    title: 'QA Evaluation',
    actor: 'QA Reviewer',
    helper: '(See phase-specific helper text below.)',
    // Field list is driven by phase — handled in render
    primary: 'approve',
    primaryLabel: 'Approve & forward to Dept Comments',
  },
  PENDING_DEPT_COMMENT: {
    title: 'Department-Wise Comments',
    actor: 'HOD of each requested department',
    helper: 'Each requested dept HOD fills their comment in the accordion below — including Remark, Action / Activity Required, and (when required) Target Date. Once all are complete the QA Reviewer forwards to RA Evaluation.',
    fields: [],
    primary: 'approve',
    primaryLabel: 'Forward to RA Evaluation',
    secondary: { kind: 'transition', target: 'PENDING_QA_REVIEW', label: 'Send back to QA' },
  },
  PENDING_RA_REVIEW: {
    title: 'RA Evaluation',
    actor: 'RA Head',
    // Round-2 H1: CC Type (category) is already set by QA at Phase 1 —
    // RA sees it read-only, doesn't re-enter it.
    // Round-2 H2: Regulatory Assessment Required + Submission Reference
    // are RA's exclusive turf — moved out of QA Phase 2.
    helper: 'Capture the regulatory submission decision and supporting reference.',
    fields: ['regulatorySubmissionRequired', 'regulatorySubmissionReference'],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_SITE_HEAD: {
    title: 'Site Head Concurrence',
    actor: 'Site Head',
    helper: 'Record the Site Head\'s concurrence remark and forward.',
    fields: ['comments'],
    requiredFields: ['comments'],
    primary: 'approve',
    primaryLabel: 'Concurrence & forward to Head QA',
  },
  PENDING_CUSTOMER_COMMENT: {
    title: 'Customer Approval',
    actor: 'Customer Representative',
    helper: 'Capture the Customer Representative\'s details and their feedback comment, then forward.',
    fields: ['customerRepresentative', 'customerComment'],
    requiredFields: ['customerRepresentative', 'customerComment'],
    primary: 'approve',
    primaryLabel: 'Forward to Head QA',
  },
  PENDING_HEAD_QA: {
    title: 'Approval by Head QA',
    actor: 'Head of QA',
    // Round-3 R26: the workflow Remark / Justification IS the Approval
    // Comment at this stage — no separate field. The TextField label flips
    // to "Approval Comment" via a per-stage rule in the JSX below.
    // Round-3 R28: Head QA forwards to Department Attachments (where each
    // dept that flagged action_required uploads supporting documents) and
    // from there to Verification.
    helper: 'Record the final approval narrative as the Approval Comment, then approve. Departments that flagged Action Required will upload supporting attachments before Verification.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Approve & forward',
  },
  PENDING_ATTACHMENTS: {
    title: 'Department Attachments',
    actor: 'Action-Required Department HODs → Head of QA',
    helper: 'Each department that flagged Action Required during Department-Wise Comments uploads a supporting document with a remark. Head QA approves each row. Once every row is APPROVED the record advances to Verification.',
    fields: [],
    requiredFields: [],
    primary: 'approve',
    primaryLabel: 'Advance to Verification',
  },
  PENDING_VERIFICATION: {
    title: 'Verification of Change Implementation',
    actor: 'Initiator → Manager QA → Head QA',
    // Round-3 R29: Documents Reissue toggle removed (it confused testers
    // and the implementation team can already capture it in the narrative).
    helper: 'Initiator fills Action Taken / Effective On. Manager QA reviews — Head QA closes the record.',
    fields: [
      'verificationActionTaken', 'verificationEffectiveOn',
      'verificationOtherComments', 'verificationRegCommunication',
    ],
    requiredFields: ['verificationActionTaken', 'verificationEffectiveOn'],
    primary: 'close',
    primaryLabel: 'Close Change Control',
  },
};

// Friendly labels for the required-field error message
const FIELD_LABELS = {
  initialAssessment: 'Initial Assessment',
  category: 'Change Control Type',
  preRemark: 'Pre-Remark',
  qaEvalRemark: 'QA Evaluation Remark',
  comments: 'Comments / Concurrence',
  customerRepresentative: 'Customer Representative',
  customerComment: 'Customer Comments',
  approvalComments: 'Approval Comments',
  verificationActionTaken: 'Action Taken / Documents Closed',
  verificationEffectiveOn: 'Effective / Implemented On',
};

// Round-4 L2: InitiatorContext (the Alert-style "captured by initiator"
// block) retired — replaced by the linear flow's StageSection at key=DRAFT
// which renders RoDraftView. The component below is kept commented out as
// reference for the canonical Initiator-captured field list.
// eslint-disable-next-line no-unused-vars
const _InitiatorContext_legacy = ({ record, lineItems }) => (
  <Alert severity="info" icon={false} sx={{ mb: 2 }}>
    <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        CAPTURED BY INITIATOR
      </Typography>
      <SectionStamp actor={record?.raisedByName || record?.createdBy}
                    when={record?.createdAt} />
    </Stack>
    <Grid container spacing={1} sx={{ mt: 0.5 }}>
      {record.recordNumber && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Control Number:</strong> {record.recordNumber}</Typography>
        </Grid>
      )}
      {record.createdAt && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Date:</strong> {String(record.createdAt).slice(0, 10)}</Typography>
        </Grid>
      )}
      {record.department && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Department:</strong> {record.department}</Typography>
        </Grid>
      )}
      {record.productMaterial && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Product / Material Name:</strong> {record.productMaterial}</Typography>
        </Grid>
      )}
      {record.productMaterialCode && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Product / Material Code:</strong> {record.productMaterialCode}</Typography>
        </Grid>
      )}
      {record.changeType && (
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Type:</strong> {record.changeType}</Typography>
        </Grid>
      )}
      {record.initialAttachmentDmsNumber && (
        <Grid item xs={12}>
          <Typography variant="body2">
            <strong>Attachment:</strong> {record.initialAttachmentDmsNumber} v{record.initialAttachmentDmsVersion || '?'}
            {record.initialAttachmentDmsTitle && ` · ${record.initialAttachmentDmsTitle}`}
          </Typography>
        </Grid>
      )}
      {!record.initialAttachmentDmsNumber && record.initialAttachmentRef && (
        <Grid item xs={12}>
          <Typography variant="body2"><strong>Attachment:</strong> {record.initialAttachmentRef}</Typography>
        </Grid>
      )}
    </Grid>

    {Array.isArray(lineItems) && lineItems.length > 0 && (
      <>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
          LINE ITEMS ({lineItems.length})
        </Typography>
        <Stack spacing={1}>
          {lineItems.map((li, idx) => (
            <Box key={li.id || idx} sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1,
                p: 1, bgcolor: 'background.paper',
              }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                #{idx + 1} {li.proposedDate && `· proposed ${li.proposedDate}`}
              </Typography>
              {li.existingSystem && (
                <Typography variant="body2" sx={{ mt: 0.3, whiteSpace: 'pre-wrap' }}>
                  <strong>Existing:</strong> {li.existingSystem}
                </Typography>
              )}
              {li.proposedSystem && (
                <Typography variant="body2" sx={{ mt: 0.2, whiteSpace: 'pre-wrap' }}>
                  <strong>Proposed:</strong> {li.proposedSystem}
                </Typography>
              )}
              {li.justification && (
                <Typography variant="body2" sx={{ mt: 0.2, whiteSpace: 'pre-wrap' }}>
                  <strong>Remark / Justification:</strong> {li.justification}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </>
    )}
  </Alert>
);

// Round-3 R18: ActivityHistory removed — it duplicated the drawer-level
// Status History block. Status History now carries the fromStatus → toStatus
// pair with actor + timestamp, which covers every use case Activity History
// did. The Resend-count chip is surfaced in the drawer header.

// Round-3 R16 / R19: small helper that finds the StatusHistory entry that
// terminated a given stage. Round-4 L2: replaced by flowFindStageActor from
// LinearFlow; the legacy version is kept (but unused) until the migration
// of the other 4 module panels stabilises.
// eslint-disable-next-line no-unused-vars
const findStageActor = (history, terminalTransitions) => {
  if (!Array.isArray(history) || history.length === 0) return null;
  // walk most-recent → first, return the first match. Using fromStatus as
  // the discriminator catches the actual stage that produced the data
  // (e.g. PENDING_HOD → anywhere = HOD's signoff).
  for (const h of [...history].reverse()) {
    if (terminalTransitions.includes(h.fromStatus)) {
      return { actor: h.changedByUsername || h.actor, when: h.changedAt || h.timestamp };
    }
  }
  return null;
};

const SectionStamp = ({ actor, when }) => {
  if (!actor && !when) return null;
  const d = when ? new Date(when) : null;
  const formatted = d && !isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    : null;
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
      by <strong>{actor || '—'}</strong>{formatted ? ` · on ${formatted}` : ''}
    </Typography>
  );
};

// ── Field renderer ─────────────────────────────────────────────────
const FieldEditor = ({ name, form, setForm, xs = 12 }) => {
  const set = (val) => setForm((p) => ({ ...p, [name]: val }));
  const v = form[name] ?? '';

  switch (name) {
    case 'initialAssessment':
      return (
        <Grid item xs={xs}>
          <TextField label="Initial Assessment" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="HOD's initial assessment of the proposed change…"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'category':
      // Round-3 R20: renamed to "Risk Level" UI-side. The underlying column
      // stays as `category` to avoid churning the schema; the UI label is
      // the single source of truth presented to the user.
      return (
        <Grid item xs={6}>
          <TextField label="Risk Level" select required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     helperText="Critical / Major / Minor — drives the auto-target-date on QA Head approval.">
            {['', 'Critical', 'Major', 'Minor'].map((c) => (
              <MenuItem key={c || '__'} value={c}>{c || <em>— select —</em>}</MenuItem>
            ))}
          </TextField>
          {v && (
            <Box sx={{ mt: 1 }}>
              <Chip size="small"
                    label={`Risk: ${v}`}
                    color={v === 'Critical' ? 'error' : v === 'Major' ? 'warning' : 'info'} />
            </Box>
          )}
        </Grid>
      );
    case 'regulatorySubmissionRequired':
      return (
        <Grid item xs={6}>
          <FormControlLabel
            control={<Switch checked={!!form[name]} onChange={(e) => set(e.target.checked)} />}
            label="Regulatory Assessment Required"
          />
        </Grid>
      );
    case 'regulatorySubmissionReference':
      return form.regulatorySubmissionRequired ? (
        <Grid item xs={6}>
          <TextField label="Submission Reference / Dossier" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Dossier number, country, etc."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      ) : null;
    case 'comments':
      return (
        <Grid item xs={12}>
          <TextField label="Concurrence / Remark" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Recorded on the audit trail."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'customerRepresentative':
      return (
        <Grid item xs={6}>
          <TextField label="Customer Representative" fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Customer's contact name"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'customerComment':
      return (
        <Grid item xs={12}>
          <TextField label="Customer Comments" multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Customer's feedback on the proposed change"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'approvalComments':
      return (
        <Grid item xs={12}>
          <TextField label="Approval Comments" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Final approval narrative recorded on the printed CC form."
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationActionTaken':
      return (
        <Grid item xs={12}>
          <TextField label="Action Taken / Documents Closed" required multiline rows={3} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationEffectiveOn':
      return (
        <Grid item xs={6}>
          {/* Round-3 R29: effective/implemented date must be today or later.
              Picker enforces min via the input attr; server re-validates. */}
          <TextField label="Effective / Implemented On" type="date" required fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     InputLabelProps={{ shrink: true }}
                     placeholder="DD/MM/YYYY"
                     helperText="DD/MM/YYYY — today or later"
                     inputProps={{
                       autoComplete: 'off',
                       min: new Date().toISOString().slice(0, 10),
                     }} />
        </Grid>
      );
    case 'verificationDocumentsReissue':
      // Round-3 R29: Documents Reissue toggle removed from the verification
      // form entirely. Field kept on the entity for legacy records.
      return null;
    case 'verificationRegCommunication':
      return (
        <Grid item xs={12}>
          <TextField label="Communication to Reg. Department" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     placeholder="Date + document submission details"
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    case 'verificationOtherComments':
      return (
        <Grid item xs={12}>
          <TextField label="Other Comments" multiline rows={2} fullWidth value={v}
                     onChange={(e) => set(e.target.value)}
                     inputProps={{ autoComplete: 'off' }} />
        </Grid>
      );
    default:
      return null;
  }
};

// ── Linear-flow read-only views ──────────────────────────────────
// Each function renders a compact summary of the data captured during
// that stage. Used when the stage is in the past (or terminal).

// Round-4 F1: line items now render via the shared QmsLineItemsSection
// in readOnly mode so the styling matches the disabled Line Items block
// the user sees in the drawer's accordion below.
// Round-5 H6 + K2: render every Initiator-captured field unconditionally
// with "—" placeholders for missing values so the HOD never sees a blank
// Draft section. K2 added an explicit info banner at the top so reviewers
// know this block is the Initiator's submission (vs the editable HOD form
// below).
const RoDraftView = ({ record }) => {
  const dash = (v) => (v == null || v === '' ? '—' : v);
  // Round-L (2026-06-27): the helper banner only makes sense while the
  // record is at Initiation or Peer Review. Once it advances to HOD
  // Assessment (or beyond) the instruction "write your Initial
  // Assessment in the form lower down" is stale, so hide the banner.
  const showHelperBanner = record?.status === 'DRAFT' || record?.status === 'PENDING_REVIEW';
  return (
    <>
      {showHelperBanner && (
        <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.6 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            <strong>The fields below were captured by the Initiator on the Create dialog.</strong>
            {' '}Review them, then write your <em>Initial Assessment</em> and
            <em> Remark / Justification</em> in the form lower down before forwarding to QA.
          </Typography>
        </Alert>
      )}
      <Grid container spacing={1.2}>
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Control Title:</strong> {dash(record.title)}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Control No.:</strong> {dash(record.recordNumber)}</Typography>
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
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Change Type:</strong> {dash(record.changeType)}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Product / Material Name:</strong> {dash(record.productMaterial)}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2"><strong>Product / Material Code:</strong> {dash(record.productMaterialCode)}</Typography>
        </Grid>
        {record.changeReason && (
          <Grid item xs={12}>
            <Typography variant="body2"><strong>Reason for Change:</strong></Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.changeReason}</Typography>
          </Grid>
        )}
        {record.initialAttachmentDmsNumber && (
          <Grid item xs={12}>
            <Typography variant="body2">
              <strong>Initial Attachment:</strong> {record.initialAttachmentDmsNumber}
              {record.initialAttachmentDmsTitle && ` · ${record.initialAttachmentDmsTitle}`}
              {record.initialAttachmentDmsVersion && ` v${record.initialAttachmentDmsVersion}`}
            </Typography>
          </Grid>
        )}
      </Grid>
      {record?.id && (
        <Box sx={{ mt: 1.8 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4, mb: 0.5, color: 'text.secondary' }}>
            LINE ITEMS
          </Typography>
          <QmsLineItemsSection
            commonSlug="change-control"
            recordId={record.id}
            readOnly
          />
        </Box>
      )}
    </>
  );
};

// Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: editable
// version of RoDraftView rendered when the record is at DRAFT and
// the Initiator (or a Resend recipient) needs to update the fields
// they originally captured. Read-only metadata (Record No., Raised
// By, Raised On, Department) stay static; the five Initiator-owned
// fields (Title, Product/Material Name + Code, Change Type, Reason
// for Change) become editable TextFields bound to the panel form
// state. Line items render via QmsLineItemsSection in edit mode.
const DraftEditView = ({ record, form, setForm }) => {
  const dash = (v) => (v == null || v === '' ? '—' : v);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isResend = (record?.resendCount ?? 0) > 0;
  return (
    <>
      <Alert severity={isResend ? 'warning' : 'info'} icon={false}
             sx={{ mb: 1.5, py: 0.6 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          {isResend
            ? <><strong>Record was sent back for edits.</strong>{' '}
                Update any of the initiator-captured fields below, then
                click <em>Save Draft</em> to persist changes or
                <em> Submit for Review</em> to forward the corrected
                record.</>
            : <><strong>Initiator draft — every field below is editable.</strong>{' '}
                Save Draft to keep working; Submit for Review to forward
                the record to a peer reviewer in your department.</>}
        </Typography>
      </Alert>

      <Grid container spacing={1.4}>
        <Grid item xs={6}>
          <TextField
            label="Change Control Title" required fullWidth size="small"
            value={form.title ?? ''} onChange={set('title')}
            inputProps={{ autoComplete: 'off' }} />
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2" sx={{ pt: 1 }}>
            <strong>Change Control No.:</strong> {dash(record.recordNumber)}
          </Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="body2" sx={{ pt: 0.6 }}>
            <strong>Raised By:</strong> {dash(record.raisedByName || record.createdBy)}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2" sx={{ pt: 0.6 }}>
            <strong>Raised On:</strong> {record.createdAt ? formatDate(record.createdAt) : '—'}
          </Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="body2" sx={{ pt: 0.6 }}>
            <strong>Department:</strong> {dash(record.department)}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Change Type" select required fullWidth size="small"
            value={form.changeType ?? ''} onChange={set('changeType')}
            SelectProps={{ native: true }}
            inputProps={{ autoComplete: 'off' }}>
            <option value=""></option>
            {['Process','Equipment','Document','System','Supplier','Facility'].map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </TextField>
        </Grid>

        <Grid item xs={6}>
          <TextField
            label="Product / Material Name" required fullWidth size="small"
            value={form.productMaterial ?? ''} onChange={set('productMaterial')}
            inputProps={{ autoComplete: 'off' }} />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Product / Material Code" required fullWidth size="small"
            value={form.productMaterialCode ?? ''} onChange={set('productMaterialCode')}
            inputProps={{ autoComplete: 'off' }} />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Reason for Change" fullWidth size="small"
            multiline minRows={2}
            value={form.changeReason ?? ''} onChange={set('changeReason')}
            inputProps={{ autoComplete: 'off' }} />
        </Grid>

        {record.initialAttachmentDmsNumber && (
          <Grid item xs={12}>
            <Typography variant="body2">
              <strong>Initial Attachment:</strong> {record.initialAttachmentDmsNumber}
              {record.initialAttachmentDmsTitle && ` · ${record.initialAttachmentDmsTitle}`}
              {record.initialAttachmentDmsVersion && ` v${record.initialAttachmentDmsVersion}`}
            </Typography>
          </Grid>
        )}
      </Grid>

      {record?.id && (
        <Box sx={{ mt: 1.8 }}>
          <Typography variant="caption"
            sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.4,
                  mb: 0.5, color: 'text.secondary' }}>
            LINE ITEMS
          </Typography>
          <QmsLineItemsSection
            commonSlug="change-control"
            recordId={record.id}
            // Round-M — editable at DRAFT so the initiator can adjust
            // Existing System / Proposed System / Justification after a
            // resend.
            readOnly={false}
          />
        </Box>
      )}
    </>
  );
};

// Round-L: peer-review gate has no dedicated record field — the
// reviewer's remark is captured as the workflow transition comment
// (rendered via stamp.comment as REMARK / JUSTIFICATION below the
// StageSection body) and the reviewer's name + timestamp surfaces
// via the SectionStamp header. So the body of this past-state block
// is intentionally empty — there's nothing else to show.
// eslint-disable-next-line no-unused-vars
const RoReviewView = ({ record }) => null;

const RoHodView = ({ record }) => (
  record.initialAssessment
    ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.initialAssessment}</Typography>
    : <Typography variant="caption" color="text.secondary">No initial assessment narrative.</Typography>
);

const RoQaPhase1View = ({ record }) => (
  <Grid container spacing={1}>
    {record.category && (
      <Grid item xs={6}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2"><strong>Risk Level:</strong></Typography>
          <Chip size="small" label={record.category}
                color={record.category === 'Critical' ? 'error'
                     : record.category === 'Major'    ? 'warning' : 'info'} />
        </Stack>
      </Grid>
    )}
    {record.preRemark && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Pre-Remark:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.preRemark}</Typography>
      </Grid>
    )}
  </Grid>
);

const RoDeptCommentsView = ({ deptComments }) => (
  deptComments?.length > 0
    ? (
      <Stack spacing={1}>
        {deptComments.map((c) => (
          <Box key={c.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" fontWeight={600}>{c.departmentName}</Typography>
              <Chip size="small" label={c.status}
                    color={c.status === 'COMPLETED' ? 'success' : 'warning'} />
              {c.actionRequired && <Chip size="small" color="warning" label="Action Required" />}
              {c.targetDate && <Chip size="small" variant="outlined" label={`Target ${formatDate(c.targetDate)}`} />}
              {c.doneByName && (
                <Typography variant="caption" color="text.secondary">
                  by {c.doneByName}{c.doneAt ? ` · ${formatDate(c.doneAt)}` : ''}
                </Typography>
              )}
            </Stack>
            {c.comment && (
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
            )}
          </Box>
        ))}
      </Stack>
    )
    : <Typography variant="caption" color="text.secondary">No department comments recorded.</Typography>
);

const RoQaPhase2View = ({ record }) => (
  <Grid container spacing={1}>
    {record.comments && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Post Remark:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.comments}</Typography>
      </Grid>
    )}
    {record.siteHeadRequired != null && (
      <Grid item xs={6}><Typography variant="body2"><strong>Site Head Required:</strong> {record.siteHeadRequired ? 'Yes' : 'No'}</Typography></Grid>
    )}
    {record.customerCommunicationRequired != null && (
      <Grid item xs={6}><Typography variant="body2"><strong>Customer Comm. Required:</strong> {record.customerCommunicationRequired ? 'Yes' : 'No'}</Typography></Grid>
    )}
    {record.customerCommunicationRequired && record.customerRepresentative && (
      <Grid item xs={6}><Typography variant="body2"><strong>Customer Rep:</strong> {record.customerRepresentative}</Typography></Grid>
    )}
    {record.riskAssessment && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Risk Assessment:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.riskAssessment}</Typography>
      </Grid>
    )}
  </Grid>
);

const RoRaView = ({ record }) => (
  <Grid container spacing={1}>
    <Grid item xs={6}><Typography variant="body2"><strong>Regulatory Submission Required:</strong> {record.regulatorySubmissionRequired ? 'Yes' : 'No'}</Typography></Grid>
    {record.regulatorySubmissionReference && (
      <Grid item xs={6}><Typography variant="body2"><strong>Submission Reference:</strong> {record.regulatorySubmissionReference}</Typography></Grid>
    )}
  </Grid>
);

const RoSiteHeadView = ({ record }) => (
  record.comments
    ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.comments}</Typography>
    : <Typography variant="caption" color="text.secondary">No site head concurrence remark recorded.</Typography>
);

const RoCustomerView = ({ record }) => (
  <Grid container spacing={1}>
    {record.customerRepresentative && (
      <Grid item xs={6}><Typography variant="body2"><strong>Customer Representative:</strong> {record.customerRepresentative}</Typography></Grid>
    )}
    {record.customerComment && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Customer Comment:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.customerComment}</Typography>
      </Grid>
    )}
  </Grid>
);

const RoHeadQaView = ({ record }) => (
  record.approvalComments
    ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}><strong>Approval Comment:</strong> {record.approvalComments}</Typography>
    : <Typography variant="caption" color="text.secondary">No approval comment recorded.</Typography>
);

const RoVerificationView = ({ record }) => (
  <Grid container spacing={1}>
    {record.verificationActionTaken && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Action Taken:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.verificationActionTaken}</Typography>
      </Grid>
    )}
    {record.verificationEffectiveOn && (
      <Grid item xs={6}><Typography variant="body2"><strong>Effective / Implemented On:</strong> {formatDate(record.verificationEffectiveOn)}</Typography></Grid>
    )}
    {record.verificationRegCommunication && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Reg. Communication:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.verificationRegCommunication}</Typography>
      </Grid>
    )}
    {record.verificationOtherComments && (
      <Grid item xs={12}>
        <Typography variant="body2"><strong>Other Comments:</strong></Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 1 }}>{record.verificationOtherComments}</Typography>
      </Grid>
    )}
  </Grid>
);

// ── Main panel ─────────────────────────────────────────────────────
const ChangeControlStagePanel = ({ record, onUpdated }) => {
  const status = record?.status;
  const desc   = STAGE_DESCRIPTORS[status];
  const { user: currentUser } = useAuth();

  const [form, setForm]           = useState({});
  const [comment, setComment]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState(null);
  const [resendDialog, setResendDialog] = useState(false);
  // Dedicated Resend reason — kept separate from the main Remark / Justification
  // so the user can resend without first scrolling up to fill the panel field.
  // (Round-2 C5: the resend silently no-op'd when the panel field was empty.)
  const [resendReason, setResendReason] = useState('');
  // Round-2 E3: e-sign gate before executing a workflow transition.
  // pendingAction holds the action key while the e-sign dialog is open;
  // on success doSubmit() runs the original network calls.
  const [pendingAction, setPendingAction] = useState(null);
  const [eSignOpen, setESignOpen] = useState(false);

  const [deptComments, setDeptComments] = useState([]);
  // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: separate
  // in-flight flag for the "Save Draft" action at the Initiation
  // stage so it can spin independently of Submit-for-Review.
  const [savingDraft, setSavingDraft] = useState(false);
  // lineItems state retired in Round-4 F1: the Draft StageSection now
  // mounts QmsLineItemsSection directly which fetches its own rows.

  // Two-phase QA Evaluation:
  //  Phase 1 — QA captures Risk Level + Pre-Remark, optionally invites depts.
  //  Phase 2 — every invited dept has filled their row; QA now captures the
  //            Post Remark + approval routing flags and forwards to RA.
  //
  // Round-5 H4 — qaPhase = 2 also applies when status === PENDING_DEPT_COMMENT
  // and every invited dept has COMPLETED. Previously the QA Reviewer had to
  // bounce the record back to PENDING_QA_REVIEW (a separate transition) to
  // enter Phase 2, which confused the testers. With this change the QA
  // Reviewer at PENDING_DEPT_COMMENT (all done) sees the Phase 2 form
  // immediately and can approve directly to RA Evaluation.
  const hasCompletedDeptComment = deptComments.some(d => d.status === 'COMPLETED');
  const allDeptsDone = deptComments.length > 0
                    && deptComments.every(d => d.status === 'COMPLETED');
  const qaPhase =
        (status === 'PENDING_QA_REVIEW' && hasCompletedDeptComment) ? 2
      : (status === 'PENDING_DEPT_COMMENT' && allDeptsDone)         ? 2
      : 1;

  // ── Form state setup ────────────────────────────────────────────
  useEffect(() => {
    if (!record) { setForm({}); setComment(''); return; }
    // We carry every conceivable field — render filter happens in JSX
    // based on stage. Round-2 F1: initialAssessment (HOD's) and riskAssessment
    // (QA's) are now stored in separate columns so QA's Phase-2 textarea
    // doesn't pre-populate with the HOD's text.
    const fresh = {
      // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: after the
      // Peer Reviewer / HOD sends the record back to DRAFT, the
      // Initiator needs to edit the fields they originally captured on
      // the Create dialog (Title, Product/Material, Change Type, Reason
      // for Change). We seed these into the form state so the Draft
      // edit view has controlled values.
      title:                        record.title ?? '',
      productMaterial:              record.productMaterial ?? '',
      productMaterialCode:          record.productMaterialCode ?? '',
      changeType:                   record.changeType ?? '',
      changeReason:                 record.changeReason ?? '',
      initialAssessment:            record.initialAssessment ?? '',
      category:                     record.category ?? '',
      preRemark:                    record.preRemark ?? '',
      qaEvalRemark:                 record.comments ?? '',
      // Risk Assessment "Required?" toggle starts based on whether QA has
      // already filled the narrative. Starts as FALSE (i.e. "Not Required")
      // on fresh Phase-2 entry — QA explicitly opts in.
      riskAssessmentRequired:       !!record.riskAssessment,
      riskAssessment:               record.riskAssessment ?? '',
      siteHeadRequired:             !!record.siteHeadRequired,
      customerCommunicationRequired:!!record.customerCommunicationRequired,
      regulatorySubmissionRequired: !!record.regulatorySubmissionRequired,
      regulatorySubmissionReference:record.regulatorySubmissionReference ?? '',
      customerRepresentative:       record.customerRepresentative ?? '',
      customerComment:              record.customerComment ?? '',
      comments:                     record.comments ?? '',
      approvalComments:             record.approvalComments ?? '',
      verificationActionTaken:      record.verificationActionTaken ?? '',
      verificationEffectiveOn:      record.verificationEffectiveOn ?? '',
      verificationDocumentsReissue: !!record.verificationDocumentsReissue,
      verificationOtherComments:    record.verificationOtherComments ?? '',
      verificationRegCommunication: record.verificationRegCommunication ?? '',
    };
    setForm(fresh);
    setComment('');
    setError(null);
  }, [record?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch dept comments (drives Phase 1 vs Phase 2 detection + dept-gate)
  const refreshDeptComments = useCallback(() => {
    if (!record?.id) { setDeptComments([]); return; }
    if (status !== 'PENDING_QA_REVIEW' && status !== 'PENDING_DEPT_COMMENT') {
      setDeptComments([]); return;
    }
    listDeptCommentsApi('change-control', record.id)
      .then(({ data }) => setDeptComments(data?.data || []))
      .catch(() => setDeptComments([]));
  }, [record?.id, status]);
  useEffect(() => { refreshDeptComments(); }, [refreshDeptComments]);

  // Round-4 F1: line-items fetch retired — QmsLineItemsSection now fetches
  // its own rows inside the Draft StageSection.

  if (!desc) return null;

  const deptPending     = deptComments.filter((r) => r.status === 'PENDING').length;
  const deptTotal       = deptComments.length;
  const deptCompleted   = deptTotal - deptPending;
  const isDeptCommentStage = status === 'PENDING_DEPT_COMMENT';
  const blockForward       = isDeptCommentStage && deptPending > 0;

  // ── QA Evaluation phase-specific descriptors ──────────────────
  //
  // Round-3 R21 / R22 / R24 / R25:
  //   Phase 1 — Risk Level + Pre-Remark are mandatory. Approval routing
  //              flags are HIDDEN. The workflow Remark / Justification is
  //              MANDATORY only when QA hasn't invited any departments
  //              (i.e. they're forwarding straight without a fan-out).
  //   Phase 2 — after every invited department has responded. The QA
  //              Evaluation Remark is now "Post Remark" (R24) and is
  //              mandatory. Approval routing flags BECOME AVAILABLE so
  //              QA can pick the downstream routing now that they have
  //              dept feedback in hand.
  const qaPhase1Fields = ['category', 'preRemark'];
  const qaPhase1Required = ['category', 'preRemark'];
  const qaPhase2Fields = [
    'qaEvalRemark',
    'riskAssessmentRequired', 'riskAssessment',
    'siteHeadRequired', 'customerCommunicationRequired',
    'customerRepresentative',
  ];
  const qaPhase2Required = ['qaEvalRemark'];

  // Pick the field list + required-list based on current stage / phase
  let effectiveFields    = desc.fields || [];
  let effectiveRequired  = desc.requiredFields || [];
  let effectiveHelper    = desc.helper;

  // Round-L (2026-06-27): QA-no-depts shortcut. When the QA Reviewer
  // does NOT invite any departments, the dept-comment loop is skipped
  // entirely — Phase 1 + Phase 2 fields combine into one form and the
  // action button forwards straight to RA Evaluation.
  const qaSkipDepts = status === 'PENDING_QA_REVIEW'
                      && qaPhase === 1
                      && deptTotal === 0;
  if (status === 'PENDING_QA_REVIEW') {
    if (qaSkipDepts) {
      // Combined single-pass form (Phase 1 + Phase 2 fields)
      effectiveFields   = [...qaPhase1Fields, ...qaPhase2Fields];
      effectiveRequired = [...qaPhase1Required, ...qaPhase2Required];
      effectiveHelper   = 'No departments invited — capture the Pre-Remark, Post-Remark and routing decisions, then forward directly to RA Evaluation. Invite a department from the accordion below if you want their input first.';
    } else if (qaPhase === 1) {
      effectiveFields   = qaPhase1Fields;
      effectiveRequired = qaPhase1Required;
      effectiveHelper   = 'PHASE 1 — Risk Level + Pre-Remark captured. Departments are now responding. The Remark / Justification is OPTIONAL while you wait; it becomes mandatory in Phase 2 once they finish.';
    } else {
      effectiveFields   = qaPhase2Fields;
      effectiveRequired = qaPhase2Required;
      effectiveHelper   = 'PHASE 2 — All invited departments have responded. Capture the Post Remark, decide Risk Assessment, and set Approval Routing (Site Head / Customer Communication) before forwarding to RA Evaluation.';
    }
  }
  // Round-5 H4 — at PENDING_DEPT_COMMENT with every invited dept COMPLETED,
  // render Phase 2 of the QA Evaluation form so the QA Reviewer can capture
  // Post Remark + approval routing and forward to RA in one step.
  if (status === 'PENDING_DEPT_COMMENT' && qaPhase === 2) {
    effectiveFields   = qaPhase2Fields;
    effectiveRequired = qaPhase2Required;
    effectiveHelper   = 'PHASE 2 — Every invited department has responded. Capture the Post Remark, decide Risk Assessment, and set Approval Routing before forwarding to RA Evaluation.';
  }

  // ── Submit ────────────────────────────────────────────────────
  //
  // Round-2 E3: Workflow transitions are gated behind a 21 CFR Part 11
  // e-signature. submit(action) validates inputs, then opens the e-sign
  // modal. The actual network calls run inside doSubmit(action) once the
  // server has verified the password.
  const submit = (action) => {
    if (!record) return;
    setError(null);

    // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: "Save Draft"
    // is a lightweight persist, not a workflow transition — it does
    // not need the Remark / Justification field and does not need an
    // e-signature. Go straight to doSubmit which will UPDATE the
    // Initiator-editable fields and stop there.
    if (action === 'saveDraft') {
      doSubmit(action);
      return;
    }

    // Resend uses its own dedicated reason (gathered in the Resend dialog),
    // so the main panel's "Remark / Justification" can stay empty when the
    // reviewer is sending back without first filling other fields. Other
    // actions still require the main remark for audit-trail purposes.
    const effectiveComment = action === 'resend'
      ? resendReason.trim()
      : comment.trim();

    // Round-3 R21: at QA Phase 1 with depts invited, the workflow Remark
    // is OPTIONAL — QA is still mid-flow. Other transitions stay strict.
    const remarkOptional = action !== 'resend'
                        && status === 'PENDING_QA_REVIEW'
                        && qaPhase === 1
                        && deptTotal > 0;
    if (!effectiveComment && !remarkOptional) {
      setError(action === 'resend'
        ? 'A reason is required for Resend — please enter it in the dialog.'
        : 'A Remark / Justification is required for this action — it is recorded on the audit trail.');
      return;
    }

    // Stash the action and open the e-sign dialog.
    setPendingAction(action);
    setESignOpen(true);
  };

  // doSubmit — the original network-call body. Runs only after e-sign succeeds.
  const doSubmit = async (action) => {
    if (!record) return;
    const effectiveComment = action === 'resend'
      ? resendReason.trim()
      : comment.trim();

    if (action !== 'reject' && action !== 'resend') {
      // Required-field validation
      const missing = effectiveRequired.filter((f) => {
        // Risk Assessment narrative is conditionally required (Phase 2 only when toggle is YES)
        if (f === 'riskAssessment' && !form.riskAssessmentRequired) return false;
        const v = form[f];
        if (typeof v === 'boolean') return false;
        return v == null || (typeof v === 'string' && !v.trim());
      });
      // Round-L (2026-06-27): the "at least one dept required" guard is
      // gone — when QA invites zero depts they now skip the dept-comment
      // loop and forward directly to RA Evaluation (handled by the
      // qaSkipDepts branch below).
      // Phase-2 conditional: when Risk Assessment Required = YES, narrative is mandatory
      if ((status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT')
          && qaPhase === 2
          && form.riskAssessmentRequired && !form.riskAssessment?.trim()) {
        setError('Risk Assessment is set to Required — please write the assessment narrative before forwarding.');
        return;
      }
      if (missing.length > 0) {
        const labels = missing.map((f) => FIELD_LABELS[f] || f).join(', ');
        setError(`Please fill the required field(s) before forwarding: ${labels}.`);
        return;
      }
    }

    const flag = action === 'reject'    ? setRejecting
              : action === 'resend'     ? setResending
              : action === 'saveDraft'  ? setSavingDraft
                                        : setSaving;
    flag(true);
    try {
      // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: persist
      // the Initiator-editable fields whenever we act at DRAFT. Both
      // "Save Draft" and "Submit for Review" need this write; without
      // it Submit-for-Review would forward the *un-edited* record
      // after a resend, silently losing the tester's fixes.
      if (status === 'DRAFT'
          && (action === 'submit' || action === 'saveDraft')) {
        await updateChangeControlApi(record.id, {
          title:               form.title ?? record.title,
          priority:            record.priority,
          productMaterial:     form.productMaterial ?? '',
          productMaterialCode: form.productMaterialCode ?? '',
          changeType:          form.changeType ?? '',
          changeReason:        form.changeReason ?? '',
        });
      }

      if (effectiveFields.length > 0 && action !== 'reject' && action !== 'resend'
          && action !== 'saveDraft') {
        // Map UI keys back onto backend column names where needed
        const payload = {
          title:    record.title,
          priority: record.priority,
        };
        if (status === 'PENDING_HOD') {
          // Round-2 F1: HOD writes to initial_assessment (separate column).
          // riskAssessment is reserved for QA's Phase-2 narrative.
          payload.initialAssessment = form.initialAssessment;
        }
        if (status === 'PENDING_QA_REVIEW' && qaPhase === 1) {
          payload.category   = form.category;
          payload.preRemark  = form.preRemark;
          payload.riskLevel  = form.category; // mirror — same values
          // Round-L (2026-06-27): in the no-depts shortcut we also persist
          // the Phase-2 fields so the QA Reviewer captures the post-remark
          // + approval routing in one save and the record can advance to
          // RA Evaluation with everything in place.
          if (qaSkipDepts) {
            payload.comments                     = form.qaEvalRemark;
            payload.riskAssessment               = form.riskAssessmentRequired ? form.riskAssessment : null;
            payload.siteHeadRequired             = !!form.siteHeadRequired;
            payload.customerCommunicationRequired= !!form.customerCommunicationRequired;
            payload.customerRepresentative       = form.customerCommunicationRequired
                                                    ? (form.customerRepresentative || null)
                                                    : null;
          }
        }
        if ((status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT') && qaPhase === 2) {
          // Round-2 H2: regulatorySubmissionRequired / Reference removed —
          // they live on the RA stage now.
          // Round-2 F2: customerRepresentative only persisted when
          // customerCommunicationRequired = TRUE; otherwise NULL.
          // Round-5 H4: same Phase-2 payload applies at PENDING_DEPT_COMMENT
          // once all depts are done.
          payload.comments                     = form.qaEvalRemark;
          payload.riskAssessment               = form.riskAssessmentRequired ? form.riskAssessment : null;
          payload.siteHeadRequired             = !!form.siteHeadRequired;
          payload.customerCommunicationRequired= !!form.customerCommunicationRequired;
          payload.customerRepresentative       = form.customerCommunicationRequired
                                                  ? (form.customerRepresentative || null)
                                                  : null;
        }
        if (status === 'PENDING_RA_REVIEW') {
          // Round-2 H1: category is read-only at RA (set by QA at Phase 1) —
          // we don't send it back. Only the regulatory submission fields are
          // written here.
          payload.regulatorySubmissionRequired = !!form.regulatorySubmissionRequired;
          payload.regulatorySubmissionReference = form.regulatorySubmissionRequired
                                                    ? (form.regulatorySubmissionReference || null)
                                                    : null;
        }
        if (status === 'PENDING_SITE_HEAD' || status === 'PENDING_CUSTOMER_COMMENT'
            || status === 'PENDING_HEAD_QA' || status === 'PENDING_VERIFICATION') {
          // Pass through only the keys the stage owns
          effectiveFields.forEach((f) => { payload[f] = form[f]; });
        }
        // Round-3 R26: at Head QA the workflow remark IS the Approval Comment.
        if (status === 'PENDING_HEAD_QA') {
          payload.approvalComments = effectiveComment;
        }
        await updateChangeControlApi(record.id, payload);
      }

      switch (action) {
        case 'submit':
          // Round-5 I1: DRAFT → PENDING_HOD via the dedicated submit endpoint.
          await submitChangeControlApi(record.id, effectiveComment);
          break;
        // Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6:
        // "Save Draft" persists Initiator edits without transitioning
        // the record, so the Initiator can keep working after a
        // resend without immediately forwarding to Peer Review.
        case 'saveDraft':
          // Payload write already happened above; nothing else to do
          // here — no e-signature, no transition, no comment required.
          break;
        case 'approve':
          // Round-L (2026-06-27): when QA invited zero depts, the canonical
          // "approve" target (PENDING_DEPT_COMMENT) doesn't apply — we
          // forward straight to RA Evaluation via the explicit transition
          // endpoint.
          if (qaSkipDepts) {
            await transitionChangeControlApi(record.id, {
              targetStatus: 'PENDING_RA_REVIEW',
              comment: effectiveComment,
            });
          } else {
            await approveChangeControlApi(record.id, effectiveComment);
          }
          break;
        case 'close':
          await closeChangeControlApi(record.id, effectiveComment);
          break;
        case 'reject':
          await rejectChangeControlApi(record.id, effectiveComment);
          break;
        case 'resend':
          // Resend = ANY reviewer state → DRAFT via the generic transition
          // endpoint. Backend WorkflowPosition gates who can do it from each
          // source state. Round-2 widened this from HOD-only to all reviewer
          // stages (D1 / F3 / H3).
          await transitionChangeControlApi(record.id, {
            targetStatus: 'DRAFT',
            comment: effectiveComment,
          });
          setResendReason(''); // clear so a stale value doesn't leak into next round
          break;
        case 'transition':
          await transitionChangeControlApi(record.id, {
            targetStatus: desc.secondary.target,
            comment: effectiveComment,
          });
          break;
        default:
          throw new Error('Unknown action');
      }
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      flag(false);
    }
  };

  // Primary button label adapts to the stage / phase
  let primaryLabel = desc.primaryLabel;
  if (status === 'DRAFT') {
    // Round-5 I1: post-resend the Initiator re-submits the corrected record.
    primaryLabel = record.resendCount > 0 ? 'Resend the Record' : 'Submit for Review';
  } else if (status === 'PENDING_QA_REVIEW' && qaPhase === 1) {
    // Round-L (2026-06-27): no depts invited → direct forward to RA.
    primaryLabel = qaSkipDepts
      ? 'Approve & forward to RA Evaluation'
      : 'Save & route to Department Comments';
  } else if ((status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT')
              && qaPhase === 2) {
    // Round-5 H4: PENDING_DEPT_COMMENT (all done) advances to RA from here.
    primaryLabel = 'Approve & forward to RA Evaluation';
  }

  // ── Round-4 linear-flow ────────────────────────────────────────
  // Compute the canonical stage list + a state ('past' | 'current' |
  // 'skipped' | 'future' | 'terminal') for each. Only past, current,
  // skipped, and terminal sections render; future stages stay hidden.
  const hasActionRequiredDept = deptComments.some((c) => c.actionRequired);
  const CC_STAGES = [
    // Round-5 K2: tester wants the section labelled simply "Initiation"
    // (renders "Initiation · Initiator" via the actor stamp). The HOD's
    // editable form sits below it.
    { key: 'DRAFT',                   title: 'Initiation' },
    // Round-L (2026-06-26): peer-review gate between Initiation and HOD.
    { key: 'PENDING_REVIEW',          title: 'Peer Review' },
    { key: 'PENDING_HOD',             title: 'HOD Assessment' },
    { key: 'QA_PHASE_1',              title: 'QA Evaluation — Pre-Remark',
      matchesStatus: (s) => s === 'PENDING_QA_REVIEW' && qaPhase === 1 },
    // Round-5 H4: PENDING_DEPT_COMMENT is "current" only while at least one
    // dept is still PENDING. Once they're all COMPLETED the QA Phase-2
    // synthetic key takes over so the same StageSection renders Post Remark
    // + approval routing.
    { key: 'PENDING_DEPT_COMMENT',    title: 'Department-Wise Comments',
      matchesStatus: (s) => s === 'PENDING_DEPT_COMMENT' && !allDeptsDone },
    { key: 'QA_PHASE_2',              title: 'QA Evaluation — Post-Remark',
      matchesStatus: (s) => (s === 'PENDING_QA_REVIEW' && qaPhase === 2)
                          || (s === 'PENDING_DEPT_COMMENT' && allDeptsDone) },
    { key: 'PENDING_RA_REVIEW',       title: 'RA Evaluation' },
    { key: 'PENDING_SITE_HEAD',       title: 'Site Head Concurrence',
      optional: true,
      skipReason: record?.siteHeadRequired === false
                  ? 'Site Head Required = No' : null },
    { key: 'PENDING_CUSTOMER_COMMENT', title: 'Customer Comment',
      optional: true,
      skipReason: record?.customerCommunicationRequired === false
                  ? 'Customer Communication Required = No' : null },
    { key: 'PENDING_HEAD_QA',         title: 'Approval by Head QA' },
    { key: 'PENDING_ATTACHMENTS',     title: 'Department Attachments',
      optional: true,
      skipReason: !hasActionRequiredDept
                  ? 'No department flagged Action Required' : null },
    { key: 'PENDING_VERIFICATION',    title: 'Verification of Implementation' },
    { key: 'CLOSED',                  title: 'Closed' },
  ];

  // currentIdx — which CC_STAGES entry matches the current record state
  let currentIdx = CC_STAGES.findIndex((s) =>
    s.matchesStatus ? s.matchesStatus(status) : s.key === status
  );
  // Terminal non-canonical statuses (REJECTED, CANCELLED, REOPENED) — push
  // "current" past the end so every stage renders as past.
  const isTerminalAlt = ['REJECTED', 'CANCELLED', 'REOPENED'].includes(status);
  if (currentIdx < 0 && isTerminalAlt) currentIdx = CC_STAGES.length;

  const stageState = (stage, idx) => {
    // Optional stages with a skip reason are "skipped" iff we've moved past
    // their position in the canonical order. If we're at-or-before, treat
    // them like any other (past/current/future).
    if (stage.optional && stage.skipReason && idx < currentIdx) return 'skipped';
    if (idx === currentIdx) {
      return stage.key === 'CLOSED' ? 'terminal' : 'current';
    }
    return idx < currentIdx ? 'past' : 'future';
  };

  // Who filled / closed each stage — look up StatusHistory.
  const stageActor = (stage) => {
    switch (stage.key) {
      case 'DRAFT':
        return { actor: record?.raisedByName || record?.createdBy, when: record?.createdAt };
      // Round-L (2026-06-27): peer-review gate. Find the transition row
      // that left PENDING_REVIEW — that's who reviewed it. The Remark /
      // Justification typed by the reviewer surfaces via stamp.comment.
      case 'PENDING_REVIEW':
        return flowFindStageActor(record?.statusHistory, ['PENDING_REVIEW']);
      case 'PENDING_HOD':
        return flowFindStageActor(record?.statusHistory, ['PENDING_HOD']);
      case 'QA_PHASE_1':
        // The transition that ended Phase 1 is PENDING_QA_REVIEW → PENDING_DEPT_COMMENT
        return flowFindStageActor(record?.statusHistory, ['PENDING_QA_REVIEW'], ['PENDING_DEPT_COMMENT']);
      case 'PENDING_DEPT_COMMENT':
        // Closed by transition PENDING_DEPT_COMMENT → PENDING_QA_REVIEW (back to QA Phase 2)
        return flowFindStageActor(record?.statusHistory, ['PENDING_DEPT_COMMENT']);
      case 'QA_PHASE_2':
        // Closed by transition PENDING_QA_REVIEW → PENDING_RA_REVIEW
        return flowFindStageActor(record?.statusHistory, ['PENDING_QA_REVIEW'], ['PENDING_RA_REVIEW']);
      case 'PENDING_RA_REVIEW':
        return flowFindStageActor(record?.statusHistory, ['PENDING_RA_REVIEW']);
      case 'PENDING_SITE_HEAD':
        return flowFindStageActor(record?.statusHistory, ['PENDING_SITE_HEAD']);
      case 'PENDING_CUSTOMER_COMMENT':
        return flowFindStageActor(record?.statusHistory, ['PENDING_CUSTOMER_COMMENT']);
      case 'PENDING_HEAD_QA':
        return flowFindStageActor(record?.statusHistory, ['PENDING_HEAD_QA']);
      case 'PENDING_ATTACHMENTS':
        return flowFindStageActor(record?.statusHistory, ['PENDING_ATTACHMENTS']);
      case 'PENDING_VERIFICATION':
        return flowFindStageActor(record?.statusHistory, ['PENDING_VERIFICATION']);
      case 'CLOSED':
        return {
          actor: record?.approvedByName || record?.changedByUsername,
          when: record?.closedDate || record?.approvedAt,
        };
      default:
        return null;
    }
  };

  // ── Editable body for current stage ──────────────────────────
  // The editable form (fields + Remark/Justification + StageAttachments)
  // for the stage the user is currently filling. Returned by renderEditableBody.
  const renderEditableBody = () => {
    const isQaPhase1WithDepts = status === 'PENDING_QA_REVIEW'
                                && qaPhase === 1 && deptTotal > 0;
    // Round-5 H4: Post Remark label also applies at PENDING_DEPT_COMMENT (Phase 2).
    const isQaPhase2 = qaPhase === 2
                       && (status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT');
    const remarkLabel = status === 'PENDING_HEAD_QA' ? 'Approval Comment'
                      : isQaPhase2 ? 'Post Remark'
                      : 'Remark / Justification';
    const remarkPlaceholder = status === 'PENDING_HEAD_QA'
      ? 'Final approval narrative — captured as the record\'s Approval Comment and on the audit trail.'
      : isQaPhase1WithDepts
        ? 'Optional while departments are responding. Will become mandatory in Phase 2.'
        : 'Recorded on the audit trail as the actor\'s remark for this transition.';

    return (
      <>
        {/* Stage-specific helper banner */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {effectiveHelper}
        </Typography>

        {/* Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6: at the
            Initiation stage the Initiator can edit the fields they
            originally captured (crucial after a Send-Back-to-Initiator).
            Was previously RoDraftView (read-only) which blocked edits
            after resend. At Peer Review the captured fields are already
            rendered in the past Initiation section above, so we do NOT
            re-render them here. */}
        {status === 'DRAFT' && (
          <Box sx={{ mb: 2 }}>
            <DraftEditView record={record} form={form} setForm={setForm} />
          </Box>
        )}

        {/* Phase-1 hint: invite at least one department */}
        {status === 'PENDING_QA_REVIEW' && qaPhase === 1 && (
          <Alert severity={deptTotal === 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            {deptTotal === 0
              ? 'No departments invited yet — use the Department-Wise Comments block below to invite at least one before saving.'
              : `${deptTotal} department${deptTotal !== 1 ? 's' : ''} invited. Save will route the record to PENDING_DEPT_COMMENT.`}
          </Alert>
        )}

        {/* Round-5 H3 — Department-Wise Comments mounted INLINE between
            Pre-Remark and Remark / Justification at the QA stages. Previously
            this only lived in the drawer accordion below; the user couldn't
            see it while editing Phase 1. The same section also fills the
            invite/read role at PENDING_DEPT_COMMENT for the dept HOD. */}
        {(status === 'PENDING_QA_REVIEW' || status === 'PENDING_DEPT_COMMENT')
          && record?.id && (
          <Box sx={{ mb: 2 }}>
            <QmsDepartmentCommentsSection
              commonSlug="change-control"
              recordId={record.id}
              currentUser={currentUser}
              recordTargetDate={record?.targetCompletionDate}
              onChange={refreshDeptComments}
            />
          </Box>
        )}

        {/* Dept-attachment fan-out form (PENDING_ATTACHMENTS only) */}
        {status === 'PENDING_ATTACHMENTS' && (
          <Box sx={{ mb: 2 }}>
            <QmsDepartmentAttachmentsSection
              commonSlug="change-control"
              recordId={record.id}
              currentUser={currentUser}
            />
          </Box>
        )}

        {/* Dept-comment progress + forward gate (PENDING_DEPT_COMMENT only) */}
        {isDeptCommentStage && (
          <Alert severity={blockForward ? 'warning' : 'success'} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2">
                Department comments: <strong>{deptCompleted}</strong>/<strong>{deptTotal || 0}</strong> completed
              </Typography>
              {deptTotal === 0 && <Chip size="small" label="No departments requested yet" />}
              {blockForward && (
                <Typography variant="caption" color="text.secondary">
                  · Each requested department&apos;s HOD must fill their comment before this can be forwarded to RA Evaluation.
                </Typography>
              )}
            </Stack>
          </Alert>
        )}

        {/* Editable fields */}
        {effectiveFields.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {effectiveFields.map((f) => {
              if (f === 'preRemark') {
                return (
                  <Grid key={f} item xs={12}>
                    <TextField label="Pre-Remark" required multiline rows={3} fullWidth
                               value={form.preRemark ?? ''}
                               onChange={(e) => setForm(prev => ({ ...prev, preRemark: e.target.value }))}
                               placeholder="QA's pre-dept-comment narrative — visible to invited dept HODs."
                               inputProps={{ autoComplete: 'off' }} />
                  </Grid>
                );
              }
              if (f === 'qaEvalRemark') {
                return (
                  <Grid key={f} item xs={12}>
                    <TextField label="QA Evaluation Remark" required multiline rows={3} fullWidth
                               value={form.qaEvalRemark ?? ''}
                               onChange={(e) => setForm(prev => ({ ...prev, qaEvalRemark: e.target.value }))}
                               placeholder="QA's evaluation of the department feedback + next steps."
                               inputProps={{ autoComplete: 'off' }} />
                  </Grid>
                );
              }
              if (f === 'riskAssessmentRequired') {
                return (
                  <Grid key={f} item xs={6}>
                    <TextField label="Risk Assessment" select fullWidth
                               value={form.riskAssessmentRequired ? 'Required' : 'Not Required'}
                               onChange={(e) => setForm(prev => ({ ...prev, riskAssessmentRequired: e.target.value === 'Required' }))}>
                      <MenuItem value="Required">Required</MenuItem>
                      <MenuItem value="Not Required">Not Required</MenuItem>
                    </TextField>
                  </Grid>
                );
              }
              if (f === 'riskAssessment') {
                return form.riskAssessmentRequired ? (
                  <Grid key={f} item xs={12}>
                    <TextField label="Risk Assessment Narrative" required multiline rows={3} fullWidth
                               value={form.riskAssessment ?? ''}
                               onChange={(e) => setForm(prev => ({ ...prev, riskAssessment: e.target.value }))}
                               inputProps={{ autoComplete: 'off' }} />
                  </Grid>
                ) : null;
              }
              if (f === 'siteHeadRequired') {
                return (
                  <Grid key={f} item xs={6}>
                    <FormControlLabel
                      control={<Switch checked={!!form.siteHeadRequired}
                                       onChange={(e) => setForm(prev => ({ ...prev, siteHeadRequired: e.target.checked }))} />}
                      label="Site Head Required"
                    />
                  </Grid>
                );
              }
              if (f === 'customerCommunicationRequired') {
                return (
                  <Grid key={f} item xs={6}>
                    <FormControlLabel
                      control={<Switch checked={!!form.customerCommunicationRequired}
                                       onChange={(e) => {
                                         const next = e.target.checked;
                                         setForm(prev => ({
                                           ...prev,
                                           customerCommunicationRequired: next,
                                           ...(next ? {} : { customerRepresentative: '' }),
                                         }));
                                       }} />}
                      label="Customer Communication Required"
                    />
                  </Grid>
                );
              }
              if (f === 'customerRepresentative' && !form.customerCommunicationRequired) {
                return null;
              }
              return <FieldEditor key={f} name={f} form={form} setForm={setForm} />;
            })}
          </Grid>
        )}

        {/* Remark / Justification (relabels per stage) */}
        <TextField
          label={remarkLabel} required={!isQaPhase1WithDepts}
          multiline rows={2} fullWidth
          value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={remarkPlaceholder}
          sx={{ mb: 1.5 }}
          inputProps={{ autoComplete: 'off' }}
        />

        {/* Round-3 R15 — Stage attachments BELOW Remark / Justification. */}
        {record?.id && (
          <StageAttachments
            moduleKey="changeControl"
            recordId={record.id}
            readOnly={false}
            heading="Stage attachments"
          />
        )}
      </>
    );
  };

  // ── Read-only body for past stages ───────────────────────────
  const renderReadOnlyBody = (stageKey) => {
    switch (stageKey) {
      case 'DRAFT':                    return <RoDraftView record={record} />;
      case 'PENDING_REVIEW':           return <RoReviewView record={record} />;
      case 'PENDING_HOD':              return <RoHodView record={record} />;
      case 'QA_PHASE_1':               return <RoQaPhase1View record={record} />;
      case 'PENDING_DEPT_COMMENT':     return <RoDeptCommentsView deptComments={deptComments} />;
      case 'QA_PHASE_2':               return <RoQaPhase2View record={record} />;
      case 'PENDING_RA_REVIEW':        return <RoRaView record={record} />;
      case 'PENDING_SITE_HEAD':        return <RoSiteHeadView record={record} />;
      case 'PENDING_CUSTOMER_COMMENT': return <RoCustomerView record={record} />;
      case 'PENDING_HEAD_QA':          return <RoHeadQaView record={record} />;
      case 'PENDING_ATTACHMENTS':      return (
        <QmsDepartmentAttachmentsSection
          commonSlug="change-control"
          recordId={record.id}
          currentUser={currentUser}
        />
      );
      case 'PENDING_VERIFICATION':     return <RoVerificationView record={record} />;
      case 'CLOSED':                   return (
        <Typography variant="body2" color="success.main">
          Record closed{record?.closedDate ? ` on ${formatDate(record.closedDate)}` : ''}.
        </Typography>
      );
      default: return null;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* Round-4 linear-flow — walk every CC stage in canonical order.
          Past stages render a read-only summary stamped with actor + date.
          Skipped optional stages render a "Skipped" badge with the reason.
          The current stage renders the editable form. Future stages are
          NOT rendered at all so the user only sees what's already done +
          what's currently being done. */}
      <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Workflow Progress</Typography>
        {status === 'PENDING_QA_REVIEW' && (
          <Chip size="small" color={qaPhase === 2 ? 'success' : 'default'}
                label={`QA Phase ${qaPhase}`} />
        )}
        {(record?.resendCount > 0) && (
          <Chip size="small" color="warning" label={`Resent ${record.resendCount}×`} />
        )}
      </Stack>

      {/* Walk the canonical stage list. Render only past / current / skipped /
          terminal sections — future stages stay hidden until reached. */}
      {CC_STAGES.map((stage, idx) => {
        const state = stageState(stage, idx);
        if (state === 'future') return null;
        const stamp = stageActor(stage) || {};
        return (
          <StageSection
            key={stage.key}
            title={stage.title}
            state={state}
            actor={stamp.actor}
            when={stamp.when}
            skippedReason={state === 'skipped' ? stage.skipReason : null}
          >
            {state === 'current' ? renderEditableBody()
              : state === 'skipped' ? null
              : (
                <>
                  {renderReadOnlyBody(stage.key)}
                  {/* Round-5 H5 — surface the transition remark captured
                      when this stage was completed. Mirrors what the user
                      typed in Remark / Justification (or Post Remark /
                      Approval Comment depending on stage). */}
                  {stamp.comment && (
                    <Box sx={{ mt: 1.2, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4, color: 'text.secondary' }}>
                        REMARK / JUSTIFICATION
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.3 }}>
                        {stamp.comment}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
          </StageSection>
        );
      })}

      {/* Round-4 L2: HOD Initial Assessment + QA Pre-Remark blocks
          retired — they're now rendered by the linear flow's StageSections
          above (RoHodView + RoQaPhase1View). */}

      {/* Round-4 L2: QA Decision Summary block retired — linear flow's
          RoQaPhase2View covers it. */}

      {/* Round-3 R18: Activity History removed — it duplicated the
          drawer-level Status History block. Resend count is surfaced as
          a chip in the drawer header instead. */}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Round-4 L2: in-place editable form, dept-attachment fan-out, dept-
          progress alert, phase-1 hint, action buttons — all relocated.
          The editable form is now rendered INSIDE the current StageSection
          above (via renderEditableBody). The action buttons live in the
          StickyActionBar below so they're always visible. */}

      {/* Round-4 L2 — sticky action bar at the bottom of the drawer.
          Shows the current-stage buttons (Approve / Resend / Reject etc.)
          regardless of how far the user has scrolled. */}
      <StickyActionBar
        helperText={blockForward
          ? `${deptPending} department comment(s) still pending — forward is blocked.`
          : null}
      >
        {/* Round-M (2026-06-27) tester CC-Point-1 · Issues 5+6:
            "Save Draft" persists Initiator edits without forwarding
            the record. Rendered only at DRAFT so it doesn't clutter
            downstream stages. */}
        {status === 'DRAFT' && (
          <Tooltip title="Save Initiator edits without forwarding — record stays at Initiation">
            <span>
              <Button
                variant="outlined" color="primary"
                startIcon={<SaveIcon />}
                onClick={() => submit('saveDraft')}
                disabled={saving || savingDraft || rejecting || resending}
              >
                {savingDraft ? 'Saving…' : 'Save Draft'}
              </Button>
            </span>
          </Tooltip>
        )}

        <Tooltip title={blockForward
            ? `Cannot forward — ${deptPending} department comment(s) still pending`
            : `POST .../${desc.primary}?comment=…`}>
          <span>
            <Button
              variant="contained"
              startIcon={desc.primary === 'close' ? <SaveIcon /> : <ForwardIcon />}
              color={desc.primary === 'close' ? 'success' : 'primary'}
              onClick={() => submit(desc.primary)}
              disabled={saving || savingDraft || rejecting || resending || (!comment.trim() && !(status === 'PENDING_QA_REVIEW' && qaPhase === 1 && deptTotal > 0)) || blockForward}
            >
              {saving ? 'Saving…' : primaryLabel}
            </Button>
          </span>
        </Tooltip>

        {['PENDING_HOD','PENDING_QA_REVIEW','PENDING_RA_REVIEW','PENDING_SITE_HEAD',
          'PENDING_CUSTOMER_COMMENT','PENDING_HEAD_QA','PENDING_VERIFICATION'].includes(status) && (
          <Tooltip title="Send back to Initiator for revision — record returns to DRAFT, not REJECTED">
            <span>
              <Button
                variant="outlined" color="warning"
                startIcon={<ResendIcon />}
                onClick={() => setResendDialog(true)}
                disabled={saving || rejecting || resending}
              >
                {resending ? 'Sending…' : 'Resend to Initiator'}
              </Button>
            </span>
          </Tooltip>
        )}

        {desc.secondary && (
          <Button variant="outlined" onClick={() => submit('transition')}
                  disabled={saving || rejecting || resending || !comment.trim()}>
            {desc.secondary.label}
          </Button>
        )}

        {status === 'PENDING_HOD' && (
          <Tooltip title="POST .../reject?comment=…  (terminal — Initiator must re-raise)">
            <span>
              <Button
                variant="outlined" color="error"
                startIcon={<RejectIcon />}
                onClick={() => submit('reject')}
                disabled={saving || rejecting || resending || !comment.trim()}
              >
                {rejecting ? 'Rejecting…' : 'Reject'}
              </Button>
            </span>
          </Tooltip>
        )}
      </StickyActionBar>

      {/* Resend confirmation — has its own Reason field so the reviewer
          doesn't need to first fill the panel-level Remark to use it.
          Round-2 fix for C5: the silent fail when the panel remark was empty. */}
      <Dialog open={resendDialog} onClose={() => setResendDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Resend to Initiator?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            This will send the record back to the Initiator (status returns to <code>DRAFT</code>)
            so they can edit. <strong>The resend count will be incremented and the Initiator will receive a notification.</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This is different from <em>Reject</em> — Reject terminates the record;
            Resend keeps it alive for revision.
          </Typography>
          <TextField
            label="Reason for resend" required multiline rows={3} fullWidth autoFocus
            value={resendReason}
            onChange={(e) => setResendReason(e.target.value)}
            placeholder="Tell the Initiator what to fix. This appears in their inbox notification and is logged on the audit trail."
            error={resendDialog && resendReason.trim().length === 0 && resending === false && Boolean(error)}
            helperText="Required — minimum 5 characters."
            inputProps={{ autoComplete: 'off' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setResendDialog(false); setResendReason(''); }} disabled={resending}>
            Cancel
          </Button>
          <Button variant="contained" color="warning"
                  onClick={async () => {
                    if (resendReason.trim().length < 5) {
                      setError('Please enter at least 5 characters of reason for resend.');
                      return;
                    }
                    setResendDialog(false);
                    await submit('resend');
                  }}
                  disabled={resending || resendReason.trim().length < 5}>
            {resending ? 'Sending…' : 'Yes, Resend'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Round-2 E3 — 21 CFR Part 11 e-signature gate. Opened by submit()
          and closed by doSubmit() once the workflow API resolves. */}
      <ESignDialog
        open={eSignOpen}
        onClose={() => !saving && !rejecting && !resending && setESignOpen(false)}
        onSigned={async () => {
          try {
            await doSubmit(pendingAction);
          } finally {
            setESignOpen(false);
            setPendingAction(null);
          }
        }}
        meaning={pendingAction
          ? `${pendingAction === 'approve' ? 'Approve / Forward'
              : pendingAction === 'reject'  ? 'Reject record'
              : pendingAction === 'resend'  ? 'Resend to Initiator'
              : pendingAction === 'close'   ? 'Close record'
              : 'Workflow transition'} — ${record?.recordNumber || record?.title || ''}`
          : ''}
        recordRef={record?.recordNumber}
        actionLabel={pendingAction === 'reject' ? 'Sign & reject'
                    : pendingAction === 'resend' ? 'Sign & resend'
                    : pendingAction === 'close'  ? 'Sign & close'
                    : 'Sign & forward'}
      />
    </Box>
  );
};

export default ChangeControlStagePanel;
