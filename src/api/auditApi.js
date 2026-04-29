import apiClient from './axios';

// ── QMS Audits  /api/v1/qms-audits ────────────────────────────────────────
// GET  /           Search/list  { search, status, auditType, page, size }
export const getQmsAuditsApi     = (params)   => apiClient.get('/api/v1/qms-audits', { params });
// GET  /{id}       Single audit
export const getQmsAuditByIdApi  = (id)       => apiClient.get(`/api/v1/qms-audits/${id}`);
// POST /           Schedule new audit
export const createQmsAuditApi   = (data)     => apiClient.post('/api/v1/qms-audits', data);
// PUT  /{id}       Update details
export const updateQmsAuditApi   = (id, data) => apiClient.put(`/api/v1/qms-audits/${id}`, data);
// PATCH /{id}/start     PLANNED → IN_PROGRESS
export const startQmsAuditApi    = (id)       => apiClient.patch(`/api/v1/qms-audits/${id}/start`);
// PATCH /{id}/complete?findings=N&observations=N  → COMPLETED (auto-sets completedDate)
export const completeQmsAuditApi = (id, params) => apiClient.patch(`/api/v1/qms-audits/${id}/complete`, null, { params });
// PATCH /{id}/cancel    → CANCELLED
export const cancelQmsAuditApi   = (id)       => apiClient.patch(`/api/v1/qms-audits/${id}/cancel`);
// DELETE /{id}     Soft delete
export const deleteQmsAuditApi   = (id)       => apiClient.delete(`/api/v1/qms-audits/${id}`);

// ── Audit Trail  /api/v1/audit/logs ───────────────────────────────────────
// AuditSearchRequest: { userId, username, action, module, entityType, entityId,
//   outcome, ipAddress, from, to, page (default 0), size (default 50, max 200) }
export const searchAuditLogsApi = (params) =>
  apiClient.get('/api/v1/audit/logs', { params });

export const getAuditLogByIdApi = (id) =>
  apiClient.get(`/api/v1/audit/logs/${id}`);

export const getAuditStatsApi = (since) =>
  apiClient.get('/api/v1/audit/stats', { params: { since } });

export const getSessionTrailApi = (sessionId) =>
  apiClient.get(`/api/v1/audit/session/${sessionId}`);

export const getEntityHistoryApi = (entityType, entityId) =>
  apiClient.get(`/api/v1/audit/entity/${entityType}/${entityId}`);

export const getRecentLoginsApi = (userId, params) =>
  apiClient.get(`/api/v1/audit/users/${userId}/recent-logins`, { params });

// ManualAuditRequest: { action*, module*, entityType, entityId, description,
//   oldValue, newValue, outcome, correlationId }
export const submitManualAuditApi = (data) =>
  apiClient.post('/api/v1/audit/logs/manual', data);
