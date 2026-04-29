import apiClient from './axios';

// ── Module Field Discovery ─────────────────────────────────────────────────
// GET /api/v1/reports/modules/{module}/fields
// Returns { dimensions: [{key,label}], metrics: [{key,label}] }
export const getModuleFieldsApi = (module) =>
  apiClient.get(`/api/v1/reports/modules/${module}/fields`);

// ── Reports CRUD ───────────────────────────────────────────────────────────
// GET /api/v1/reports?page=0&size=20&mine=true&module=CAPA
export const getReportsApi = (params) =>
  apiClient.get('/api/v1/reports', { params });

// POST /api/v1/reports
// Body: { name, description, module, format, dateFrom, dateTo, dimensions[], metrics[], extraFilters }
export const createReportApi = (data) =>
  apiClient.post('/api/v1/reports', data);

// PUT /api/v1/reports/{id}
// Partial update — report re-runs automatically
export const updateReportApi = (id, data) =>
  apiClient.put(`/api/v1/reports/${id}`, data);

// ── Report Actions ─────────────────────────────────────────────────────────
// POST /api/v1/reports/{id}/run — re-execute with same config
export const runReportApi = (id) =>
  apiClient.post(`/api/v1/reports/${id}/run`);

// GET /api/v1/reports/{id}/download — returns binary blob
export const downloadReportApi = (id) =>
  apiClient.get(`/api/v1/reports/${id}/download`, { responseType: 'blob' });

// PATCH /api/v1/reports/{id}/disable
export const disableReportApi = (id) =>
  apiClient.patch(`/api/v1/reports/${id}/disable`);

// PATCH /api/v1/reports/{id}/enable
export const enableReportApi = (id) =>
  apiClient.patch(`/api/v1/reports/${id}/enable`);

// ── Run History ────────────────────────────────────────────────────────────
// GET /api/v1/reports/{id}/history?page=0&size=20
export const getReportHistoryApi = (id, params) =>
  apiClient.get(`/api/v1/reports/${id}/history`, { params });

// ── Insights ───────────────────────────────────────────────────────────────
// GET /api/v1/reports/{id}/insights — always fresh live query
export const getReportInsightsApi = (id) =>
  apiClient.get(`/api/v1/reports/${id}/insights`);

// ── Legacy dashboard summary (used by DashboardPage) ──────────────────────
export const getReportsDashboardApi = () =>
  apiClient.get('/api/v1/reports/dashboard');
