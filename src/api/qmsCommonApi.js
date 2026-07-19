import apiClient from './axios';

/**
 * qmsCommonApi — wraps the /api/v1/qms/{recordType}/{recordId}/* endpoints
 * that work uniformly across all 5 QMS sub-modules.
 *
 * recordType is a kebab-case slug of the backend QmsRecordType enum:
 *   capa | deviation | incident | change-control | market-complaint
 */

const root = (recordType, recordId) =>
  `/api/v1/qms/${recordType}/${recordId}`;

// ── Line items (Existing System / Proposed System / Justification) ──
export const listLineItemsApi = (recordType, recordId) =>
  apiClient.get(`${root(recordType, recordId)}/line-items`);

// QmsLineItemRequest: { existingSystem, proposedSystem, justification, proposedDate, status, remark }
export const createLineItemApi = (recordType, recordId, data) =>
  apiClient.post(`${root(recordType, recordId)}/line-items`, data);

export const updateLineItemApi = (recordType, recordId, lineItemId, data) =>
  apiClient.put(`${root(recordType, recordId)}/line-items/${lineItemId}`, data);

export const deleteLineItemApi = (recordType, recordId, lineItemId) =>
  apiClient.delete(`${root(recordType, recordId)}/line-items/${lineItemId}`);

// ── Department comments (multi-dept fan-out) ──
export const listDeptCommentsApi = (recordType, recordId) =>
  apiClient.get(`${root(recordType, recordId)}/department-comments`);

// QmsDepartmentCommentRequest: { departmentId, comment? }
//   - on POST: only departmentId is used (creates a PENDING row)
//   - on PUT:  comment is required (HOD fills it)
export const requestDeptCommentApi = (recordType, recordId, departmentId) =>
  apiClient.post(`${root(recordType, recordId)}/department-comments`, { departmentId });

export const fillDeptCommentApi = (recordType, recordId, commentRowId, payload) =>
  apiClient.put(`${root(recordType, recordId)}/department-comments/${commentRowId}`, payload);

// Round-L (2026-06-27): soft-delete a PENDING dept-comment row so QA
// can fix an accidental invite. Backend rejects COMPLETED rows.
export const deleteDeptCommentApi = (recordType, recordId, commentRowId) =>
  apiClient.delete(`${root(recordType, recordId)}/department-comments/${commentRowId}`);

// ── Round-N (2026-07-04) tester CC-Point-2 · Issue 6 ────────────
// Department Action Items — each dept-comment row can carry many
// discrete action items with independent target dates + statuses.
const actionRoot = (recordType, recordId, commentRowId) =>
  `${root(recordType, recordId)}/department-comments/${commentRowId}/action-items`;

export const listDeptActionItemsApi = (recordType, recordId, commentRowId) =>
  apiClient.get(actionRoot(recordType, recordId, commentRowId));

// payload: { description, targetDate? }
export const createDeptActionItemApi = (recordType, recordId, commentRowId, payload) =>
  apiClient.post(actionRoot(recordType, recordId, commentRowId), payload);

// payload: { description?, targetDate?, status? } — status:
// 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
export const updateDeptActionItemApi = (recordType, recordId, commentRowId, itemId, payload) =>
  apiClient.put(`${actionRoot(recordType, recordId, commentRowId)}/${itemId}`, payload);

export const deleteDeptActionItemApi = (recordType, recordId, commentRowId, itemId) =>
  apiClient.delete(`${actionRoot(recordType, recordId, commentRowId)}/${itemId}`);

// ── Department attachments (per-dept file upload + Head QA approval) ──
//
// Mirrors department-comments but for binary files. Backs the
// PENDING_ATTACHMENTS gate on Deviation / Incident / CAPA / Change Control.
//
// Lifecycle of a row:
//   PENDING  — Head QA / QA invited dept; no upload yet
//   PENDING  — dept uploaded an attachment_ref (still awaiting Head QA decision)
//   APPROVED — Head QA accepted (final)
//   REJECTED — Head QA rejected; dept must re-upload
export const listDeptAttachmentsApi = (recordType, recordId) =>
  apiClient.get(`${root(recordType, recordId)}/department-attachments`);

// Invite a dept (only departmentId is read on POST):
export const requestDeptAttachmentApi = (recordType, recordId, departmentId) =>
  apiClient.post(`${root(recordType, recordId)}/department-attachments`, { departmentId });

// Department uploads / updates its attachment row.
// payload: { attachmentRef, attachmentNote?, actionItemId? } — actionItemId
// links the attachment to the specific action plan it satisfies (Batch C
// RED-5). Backend enforces the overdue-guard when actionItemId is present
// and creates a fresh row instead of overwriting when the target row is
// already filled — so multiple attachments per action plan Just Work.
export const uploadDeptAttachmentApi = (recordType, recordId, rowId, payload) =>
  apiClient.put(`${root(recordType, recordId)}/department-attachments/${rowId}`, payload);

// Batch C RED-5 (2026-07-19)
// Fetch the action items belonging to a specific department on this
// record — populates the "pick an action plan" dropdown in the upload
// dialog. Returns { id, description, targetDate, extensionDate, ... }.
export const listActionItemsForDeptApi = (recordType, recordId, departmentId) =>
  apiClient.get(
    `${root(recordType, recordId)}/department-attachments/action-items`,
    { params: { departmentId } },
  );

// Record / overwrite a dept-declared extension on an overdue action item.
// payload: { extensionDate (YYYY-MM-DD), extensionReason? }
export const recordActionItemExtensionApi = (recordType, recordId, itemId, payload) =>
  apiClient.post(
    `${root(recordType, recordId)}/department-action-items/${itemId}/extension`,
    payload,
  );

// Head QA decides on a row.
// payload: { approve: boolean, comment }
export const decideDeptAttachmentApi = (recordType, recordId, rowId, payload) =>
  apiClient.post(`${root(recordType, recordId)}/department-attachments/${rowId}/decide`, payload);

// Soft-delete a non-APPROVED row (e.g. invited the wrong dept).
export const deleteDeptAttachmentApi = (recordType, recordId, rowId) =>
  apiClient.delete(`${root(recordType, recordId)}/department-attachments/${rowId}`);

// ── Target-date extension ──
export const getExtensionApi = (recordType, recordId) =>
  apiClient.get(`${root(recordType, recordId)}/target-date-extension`);

// TargetDateExtensionRequest: { extensionDate (YYYY-MM-DD), reason }
export const requestExtensionApi = (recordType, recordId, payload) =>
  apiClient.post(`${root(recordType, recordId)}/target-date-extension`, payload);

// TargetDateExtensionDecision: { approve: boolean, remark }
export const decideExtensionApi = (recordType, recordId, payload) =>
  apiClient.post(`${root(recordType, recordId)}/target-date-extension/decide`, payload);

// ── Generic record-attachment upload (Round-2 A1) ──
// Uploads a local file directly (not a DMS doc) and returns metadata
// including `attachmentRef` ("QMS-ATT-{id}") that callers store on the
// parent record's initial_attachment_ref slot.
//   payload: FormData with `file`, optional `recordType`, optional `recordId`
export const uploadRecordAttachmentApi = (file, recordType, recordId) => {
  const fd = new FormData();
  fd.append('file', file);
  if (recordType) fd.append('recordType', recordType);
  if (recordId != null) fd.append('recordId', String(recordId));
  return apiClient.post('/api/v1/qms/attachments/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const downloadRecordAttachmentApi = (id) =>
  apiClient.get(`/api/v1/qms/attachments/${id}/download`, { responseType: 'blob' });

// List every local-file attachment for the given record. recordType uses
// the QmsRecordType enum (CHANGE_CONTROL, CAPA, DEVIATION, INCIDENT,
// MARKET_COMPLAINT).
export const listRecordAttachmentsApi = (recordType, recordId) =>
  apiClient.get('/api/v1/qms/attachments', { params: { recordType, recordId } });
