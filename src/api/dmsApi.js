import apiClient from './axios';

// GET params: status, category, department, ownerId, search, page, size
export const getDocumentsApi = (params) =>
  apiClient.get('/api/v1/dms/documents', { params });

export const getDocumentByIdApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}`);

export const getDocumentStatsApi = () =>
  apiClient.get('/api/v1/dms/documents/stats');

export const getDocumentVersionsApi = (docNumber) =>
  apiClient.get(`/api/v1/dms/documents/number/${docNumber}/versions`);

export const getCurrentVersionApi = (docNumber) =>
  apiClient.get(`/api/v1/dms/documents/number/${docNumber}/current`);

// Multipart: FormData with 'file' (binary) + 'metadata' (JSON blob)
// UploadRequest: { title*, category*, description, department, tags, accessLevel,
//   effectiveDate, expiryDate, reviewDate, changeSummary, isControlled, ownerId }
export const uploadDocumentApi = (formData) =>
  apiClient.post('/api/v1/dms/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// UpdateDocumentRequest: { title, description, department, tags, accessLevel,
//   effectiveDate, expiryDate, reviewDate, changeSummary, isControlled, ownerId }
export const updateDocumentApi = (id, data) =>
  apiClient.put(`/api/v1/dms/documents/${id}`, data);

export const deleteDocumentApi = (id) =>
  apiClient.delete(`/api/v1/dms/documents/${id}`);

export const downloadDocumentApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}/download`, { responseType: 'blob' });

// POST {id}/submit?comments=
export const submitDocumentApi = (id, comments) =>
  apiClient.post(`/api/v1/dms/documents/${id}/submit`, null, { params: { comments } });

// ApprovalRequest: { comments }
export const approveDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/approve`, data);

export const rejectDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/reject`, data);

// PublishRequest: { effectiveDate }
export const publishDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/publish`, data);

// ObsoleteRequest: { reason* }
export const obsoleteDocumentApi = (id, data) =>
  apiClient.post(`/api/v1/dms/documents/${id}/obsolete`, data);

export const withdrawDocumentApi = (id) =>
  apiClient.post(`/api/v1/dms/documents/${id}/withdraw`);

export const uploadNewVersionApi = (id, formData) =>
  apiClient.post(`/api/v1/dms/documents/${id}/new-version`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDocumentApprovalsApi = (id) =>
  apiClient.get(`/api/v1/dms/documents/${id}/approvals`);

export const acknowledgeDocumentApi = (downloadLogId) =>
  apiClient.post(`/api/v1/dms/documents/downloads/${downloadLogId}/acknowledge`);
