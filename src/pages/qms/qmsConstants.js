// ── Status ────────────────────────────────────────────────────────────────────
export const STATUS_COLORS = {
  DRAFT:                    'default',
  PENDING_HOD:              'warning',
  PENDING_QA_REVIEW:        'info',
  PENDING_DEPT_COMMENT:     'warning',
  PENDING_RA_REVIEW:        'secondary',
  PENDING_SITE_HEAD:        'primary',
  PENDING_CUSTOMER_COMMENT: 'info',
  PENDING_HEAD_QA:          'warning',
  PENDING_INVESTIGATION:    'error',
  PENDING_ATTACHMENTS:      'warning',
  PENDING_VERIFICATION:     'info',
  REJECTED:                 'error',
  CLOSED:                   'success',
  CANCELLED:                'default',
  REOPENED:                 'warning',
};

export const STATUS_LABELS = {
  DRAFT:                    'Draft',
  PENDING_HOD:              'HOD Assessment Pending',
  PENDING_QA_REVIEW:        'QA Review',
  PENDING_DEPT_COMMENT:     'Pending Dept Comment',
  PENDING_RA_REVIEW:        'RA Review',
  PENDING_SITE_HEAD:        'Pending Site Head',
  PENDING_CUSTOMER_COMMENT: 'Customer Comment',
  PENDING_HEAD_QA:          'Head QA Review',
  PENDING_INVESTIGATION:    'Under Investigation',
  PENDING_ATTACHMENTS:      'Pending Attachments',
  PENDING_VERIFICATION:     'Pending Verification',
  REJECTED:                 'Rejected',
  CLOSED:                   'Closed',
  CANCELLED:                'Cancelled',
  REOPENED:                 'Reopened',
};

// ── Priority ──────────────────────────────────────────────────────────────────
export const PRIORITY_COLORS = {
  CRITICAL: 'error',
  HIGH:     'warning',
  MEDIUM:   'info',
  LOW:      'default',
};

// ── Module meta ───────────────────────────────────────────────────────────────
// moduleKey must match TABS key and the per-module API path segment.
// commonSlug is the kebab-case enum used by the cross-module
// /api/v1/qms/{recordType}/* endpoints (line items, dept comments, extension).
export const MODULE_META = {
  capa: {
    label:        'CAPA',
    endpoint:     'capa',
    commonSlug:   'capa',
    recordPrefix: 'CAPA',
    numberField:  'recordNumber',
    addLabel:     'Create CAPA',
  },
  deviation: {
    label:        'Deviation',
    endpoint:     'deviations',
    commonSlug:   'deviation',
    recordPrefix: 'DEV',
    numberField:  'recordNumber',
    addLabel:     'Report Deviation',
  },
  incident: {
    label:        'Incident',
    endpoint:     'incidents',
    commonSlug:   'incident',
    recordPrefix: 'INC',
    numberField:  'recordNumber',
    addLabel:     'Report Incident',
  },
  marketComplaint: {
    label:        'Market Complaint',
    endpoint:     'complaints',
    commonSlug:   'market-complaint',
    recordPrefix: 'MC',
    numberField:  'recordNumber',
    addLabel:     'Log Complaint',
  },
  changeControl: {
    label:        'Change Control',
    endpoint:     'change-controls',
    commonSlug:   'change-control',
    recordPrefix: 'CC',
    numberField:  'recordNumber',
    addLabel:     'Initiate Change',
  },
};

// ── Workflow helpers ──────────────────────────────────────────────────────────
// Transitions that are "optional branch" routes (not canonical forward)
export const BRANCH_TRANSITIONS   = new Set(['PENDING_SITE_HEAD', 'PENDING_CUSTOMER_COMMENT']);
// Transitions that are "destructive" (shown as danger buttons)
export const DANGER_TRANSITIONS   = new Set(['REJECTED', 'CANCELLED']);

// ── Per-module workflow stages ────────────────────────────────────────────────
// The canonical happy-path stages each module walks through. Used by
// <WorkflowStageStepper /> to show "where am I in the pipeline".
//
// Each stage has:
//   key       : QmsStatus (matches backend)
//   label     : short human label (fits in a stepper)
//   actor     : who acts at this stage (UX hint)
//   optional  : true if this stage is conditional / branch
export const WORKFLOW_STAGES = {
  capa: [
    { key: 'DRAFT',                    label: 'Draft',                 actor: 'Initiator' },
    { key: 'PENDING_HOD',              label: 'HOD Assessment',            actor: 'Dept HOD' },
    { key: 'PENDING_QA_REVIEW',        label: 'QA Review',             actor: 'QA Reviewer' },
    { key: 'PENDING_DEPT_COMMENT',     label: 'Dept Comment',          actor: 'Targeted HOD',  optional: true },
    { key: 'PENDING_HEAD_QA',          label: 'Head QA',               actor: 'QA Head' },
    { key: 'CLOSED',                   label: 'Closed',                actor: 'QA Head' },
  ],
  deviation: [
    { key: 'DRAFT',                    label: 'Draft',                 actor: 'Initiator' },
    { key: 'PENDING_HOD',              label: 'HOD Assessment',            actor: 'Dept HOD' },
    { key: 'PENDING_QA_REVIEW',        label: 'QA Review',             actor: 'QA Reviewer' },
    { key: 'PENDING_RA_REVIEW',        label: 'RA Review',             actor: 'RA Head' },
    { key: 'PENDING_SITE_HEAD',        label: 'Site Head',             actor: 'Site Head',     optional: true },
    { key: 'PENDING_INVESTIGATION',    label: 'Investigation',         actor: 'Assignee' },
    { key: 'PENDING_VERIFICATION',     label: 'Verification',          actor: 'QA Reviewer' },
    { key: 'CLOSED',                   label: 'Closed',                actor: 'QA Head' },
  ],
  incident: [
    { key: 'DRAFT',                    label: 'Draft',                 actor: 'Initiator' },
    { key: 'PENDING_HOD',              label: 'HOD Assessment',            actor: 'Dept HOD' },
    { key: 'PENDING_INVESTIGATION',    label: 'Investigation',         actor: 'Assignee' },
    { key: 'PENDING_ATTACHMENTS',      label: 'Attachments',           actor: 'Initiator',     optional: true },
    { key: 'PENDING_VERIFICATION',     label: 'Verification',          actor: 'QA Reviewer' },
    { key: 'PENDING_HEAD_QA',          label: 'Head QA',               actor: 'QA Head' },
    { key: 'CLOSED',                   label: 'Closed',                actor: 'QA Head' },
  ],
  marketComplaint: [
    { key: 'DRAFT',                    label: 'Draft',                 actor: 'Initiator' },
    { key: 'PENDING_HOD',              label: 'HOD Assessment',            actor: 'Dept HOD' },
    { key: 'PENDING_INVESTIGATION',    label: 'Investigation',         actor: 'Assignee' },
    { key: 'PENDING_ATTACHMENTS',      label: 'Attachments',           actor: 'Initiator' },
    { key: 'PENDING_VERIFICATION',     label: 'Verification',          actor: 'QA Reviewer' },
    { key: 'CLOSED',                   label: 'Closed',                actor: 'QA Head' },
  ],
  // Change Control follows the printed VI-Pharma form most closely, so it has
  // the longest pipeline. PENDING_SITE_HEAD and PENDING_CUSTOMER_COMMENT are
  // optional branches taken only when siteHeadRequired / customerCommunicationRequired.
  changeControl: [
    { key: 'DRAFT',                    label: 'Initiation',            actor: 'Initiator' },
    { key: 'PENDING_HOD',              label: 'HOD Assessment',            actor: 'Dept HOD' },
    { key: 'PENDING_QA_REVIEW',        label: 'QA Evaluation',         actor: 'QA Reviewer' },
    { key: 'PENDING_DEPT_COMMENT',     label: 'Dept Comments',         actor: 'Targeted HODs' },
    { key: 'PENDING_RA_REVIEW',        label: 'RA Evaluation',         actor: 'RA Head' },
    { key: 'PENDING_SITE_HEAD',        label: 'Site Head',             actor: 'Site Head',     optional: true },
    { key: 'PENDING_CUSTOMER_COMMENT', label: 'Customer Comment',      actor: 'Customer Rep',  optional: true },
    { key: 'PENDING_HEAD_QA',          label: 'Head QA Approval',      actor: 'QA Head' },
    { key: 'PENDING_VERIFICATION',     label: 'Verification',          actor: 'QA Reviewer' },
    { key: 'CLOSED',                   label: 'Closed',                actor: 'QA Head' },
  ],
};

/** Returns the WORKFLOW_STAGES list for a moduleKey, or [] if unknown. */
export const getWorkflowStages = (moduleKey) => WORKFLOW_STAGES[moduleKey] || [];

/**
 * From the full allowedTransitions array, pick the canonical "forward"
 * transitions — i.e. PENDING_* states that are not optional branch states.
 */
export const getPrimaryForward = (allowed = []) =>
  allowed.filter((t) => t.startsWith('PENDING_') && !BRANCH_TRANSITIONS.has(t));

// Labels for workflow action buttons
export const ACTION_LABELS = {
  submit:   'Submit for Review',
  approve:  'Approve / Forward',
  close:    'Close Record',
  reject:   'Reject / Send Back',
  cancel:   'Cancel',
  reopen:   'Reopen',
  PENDING_SITE_HEAD:        'Route to Site Head',
  PENDING_CUSTOMER_COMMENT: 'Request Customer Comment',
};
