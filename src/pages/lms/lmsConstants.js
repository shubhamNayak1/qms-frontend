// ── Program Status ────────────────────────────────────────────────────────────
export const PROGRAM_STATUS_COLORS = {
  DRAFT:        'default',
  UNDER_REVIEW: 'info',
  APPROVED:     'success',
  PLANNED:      'primary',
  ACTIVE:       'success',
  COMPLETED:    'secondary',
  REJECTED:     'error',
  ARCHIVED:     'default',
};

export const PROGRAM_STATUS_LABELS = {
  DRAFT:        'Draft',
  UNDER_REVIEW: 'Under Review',
  APPROVED:     'Approved',
  PLANNED:      'Planned',
  ACTIVE:       'Active',
  COMPLETED:    'Completed',
  REJECTED:     'Rejected',
  ARCHIVED:     'Archived',
};

// ── Enrollment Status ─────────────────────────────────────────────────────────
export const ENROLLMENT_STATUS_COLORS = {
  ALLOCATED:           'default',
  ENROLLED:            'info',
  IN_PROGRESS:         'info',
  PENDING_REVIEW:      'warning',
  PENDING_HR_REVIEW:   'warning',
  PENDING_QA_APPROVAL: 'warning',
  COMPLETED:           'success',
  FAILED:              'error',
  RETRAINING:          'error',
  EXPIRED:             'default',
  WAIVED:              'secondary',
  CANCELLED:           'default',
};

export const ENROLLMENT_STATUS_LABELS = {
  ALLOCATED:           'Allocated',
  ENROLLED:            'Enrolled',
  IN_PROGRESS:         'In Progress',
  PENDING_REVIEW:      'Pending Review',
  PENDING_HR_REVIEW:   'Pending HR Review',
  PENDING_QA_APPROVAL: 'Pending QA Approval',
  COMPLETED:           'Completed',
  FAILED:              'Failed',
  RETRAINING:          'Retraining',
  EXPIRED:             'Expired',
  WAIVED:              'Waived',
  CANCELLED:           'Cancelled',
};

// ── Training Type ─────────────────────────────────────────────────────────────
export const TRAINING_TYPE_COLORS  = { SCHEDULED: 'primary', SELF: 'info', INDUCTION: 'secondary' };
export const TRAINING_TYPE_LABELS  = { SCHEDULED: 'Scheduled', SELF: 'Self-Paced', INDUCTION: 'Induction' };
export const TRAINING_SUBTYPE_LABELS = { TEMPORARY: 'Temporary', REGULAR: 'Regular', REFRESHER: 'Refresher', OJT: 'OJT' };

// ── Certificate Status ────────────────────────────────────────────────────────
export const CERT_STATUS_COLORS = { ACTIVE: 'success', EXPIRED: 'default', REVOKED: 'error' };

// ── Program Workflow Transitions ──────────────────────────────────────────────
// action = URL segment for POST /programs/{id}/{action}
export const PROGRAM_TRANSITIONS = {
  DRAFT:        [{ action: 'raise-review', label: 'Submit for Review',   color: 'primary' }],
  REJECTED:     [{ action: 'raise-review', label: 'Resubmit for Review', color: 'warning' }],
  UNDER_REVIEW: [
    { action: 'approve', label: 'Approve', color: 'success' },
    { action: 'reject',  label: 'Reject',  color: 'error',   requireReason: true },
  ],
  APPROVED:  [{ action: 'plan',     label: 'Mark as Planned', color: 'primary',   note: 'Requires at least one session' }],
  PLANNED:   [{ action: 'activate', label: 'Activate',        color: 'success' }],
  ACTIVE:    [{ action: 'complete', label: 'Mark Completed',  color: 'secondary' }],
  COMPLETED: [{ action: 'archive',  label: 'Archive',         color: 'default'   }],
};
