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
  PENDING_HOD:              'Pending HOD',
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
// moduleKey must match TABS key and the API path segment
export const MODULE_META = {
  capa: {
    label:        'CAPA',
    endpoint:     'capa',
    recordPrefix: 'CAPA',
    numberField:  'recordNumber',
    addLabel:     'Create CAPA',
  },
  deviation: {
    label:        'Deviation',
    endpoint:     'deviations',
    recordPrefix: 'DEV',
    numberField:  'recordNumber',
    addLabel:     'Report Deviation',
  },
  incident: {
    label:        'Incident',
    endpoint:     'incidents',
    recordPrefix: 'INC',
    numberField:  'recordNumber',
    addLabel:     'Report Incident',
  },
  marketComplaint: {
    label:        'Market Complaint',
    endpoint:     'complaints',
    recordPrefix: 'MC',
    numberField:  'recordNumber',
    addLabel:     'Log Complaint',
  },
  changeControl: {
    label:        'Change Control',
    endpoint:     'change-controls',
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
