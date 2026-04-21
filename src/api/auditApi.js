import apiClient from './axios';

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
