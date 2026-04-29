import apiClient from './axios';

// ── Search & Read ──────────────────────────────────────────────────────────
// GET params: status, category, department, ownerId, search, page, size
export const getDocumentsApi = (params) =>
  apiClient.get('/api/v1/dms/documents', { params });

export const getDocumentByIdApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}`);

// GET /number/{docNumber}/current — latest effective version
export const getCurrentVersionApi = (docNumber) =>
  apiClient.get(`/api/v1/dms/documents/number/${docNumber}/current`);

// GET /number/{docNumber}/versions — full version chain, newest-first
export const getDocumentVersionsApi = (docNumber) =>
  apiClient.get(`/api/v1/dms/documents/number/${docNumber}/versions`);

// GET /{id}/approvals
export const getDocumentApprovalsApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}/approvals`);

// GET /stats
export const getDocumentStatsApi = () =>
  apiClient.get('/api/v1/dms/documents/stats');

// ── Upload ─────────────────────────────────────────────────────────────────
// POST / — multipart: file + metadata (JSON Blob)
// UploadRequest: { title*, category*, description, department, tags[],
//   accessLevel, effectiveDate, expiryDate, reviewDate,
//   changeSummary, isControlled, ownerId }
export const uploadDocumentApi = (formData) =>
  apiClient.post('/api/v1/dms/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// POST /{id}/new-version — multipart same shape
export const uploadNewVersionApi = (id, formData) =>
  apiClient.post(`/api/v1/dms/documents/${id}/new-version`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Workflow ───────────────────────────────────────────────────────────────
// POST /{id}/submit?comments=   DRAFT → UNDER_REVIEW
export const submitDocumentApi = (id, comments) =>
  apiClient.post(`/api/v1/dms/documents/${id}/submit`, null, {
    params: comments ? { comments } : undefined,
  });

// POST /{id}/approve   → APPROVED (if quorum met)
export const approveDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/approve`, data);

// POST /{id}/reject    → REJECTED
export const rejectDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/reject`, data);

// POST /{id}/publish   APPROVED → EFFECTIVE  { effectiveDate }
export const publishDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/publish`, data);

// POST /{id}/obsolete  EFFECTIVE → OBSOLETE  { reason* }
export const obsoleteDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/obsolete`, data);

// POST /{id}/withdraw  DRAFT/UNDER_REVIEW → WITHDRAWN
export const withdrawDocumentApi = (id) =>
  apiClient.post(`/api/v1/dms/documents/${id}/withdraw`);

// ── Download & Acknowledgement ─────────────────────────────────────────────
// GET /{id}/download
//   Local  → binary blob in response body
//   S3     → response header X-Download-URL contains pre-signed URL
export const downloadDocumentApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}/download`, { responseType: 'blob' });

// POST /downloads/{logId}/acknowledge — required for controlled docs
export const acknowledgeDocumentApi = (downloadLogId) =>
  apiClient.post(`/api/v1/dms/documents/downloads/${downloadLogId}/acknowledge`);

// ── Delete (SUPER_ADMIN only) ──────────────────────────────────────────────
export const deleteDocumentApi = (id) =>
  apiClient.delete(`/api/v1/dms/documents/${id}`);
