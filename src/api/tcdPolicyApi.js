import apiClient from './axios';

// GET  /api/v1/admin/tcd-policy             — list all module rows
// GET  /api/v1/admin/tcd-policy/{moduleKey} — one module row
// PUT  /api/v1/admin/tcd-policy/{moduleKey} — update one row
//   body: { maxDays, warningDays, extensionAllowed, maxExtensions }

export const listTcdPolicyApi = () =>
  apiClient.get('/api/v1/admin/tcd-policy');

export const getTcdPolicyApi = (moduleKey) =>
  apiClient.get(`/api/v1/admin/tcd-policy/${encodeURIComponent(moduleKey)}`);

export const updateTcdPolicyApi = (moduleKey, data) =>
  apiClient.put(`/api/v1/admin/tcd-policy/${encodeURIComponent(moduleKey)}`, data);
