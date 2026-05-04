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

// ── Target-date extension ──
export const getExtensionApi = (recordType, recordId) =>
  apiClient.get(`${root(recordType, recordId)}/target-date-extension`);

// TargetDateExtensionRequest: { extensionDate (YYYY-MM-DD), reason }
export const requestExtensionApi = (recordType, recordId, payload) =>
  apiClient.post(`${root(recordType, recordId)}/target-date-extension`, payload);

// TargetDateExtensionDecision: { approve: boolean, remark }
export const decideExtensionApi = (recordType, recordId, payload) =>
  apiClient.post(`${root(recordType, recordId)}/target-date-extension/decide`, payload);
