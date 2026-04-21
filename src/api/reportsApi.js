import apiClient from './axios';

// ── Dashboard (unified) ────────────────────────────────────────────────────
export const getReportsDashboardApi = () =>
  apiClient.get('/api/v1/reports/dashboard');

// ── CAPA Reports ───────────────────────────────────────────────────────────
// ReportFilter: { dateFrom, dateTo, statuses[], priorities[], assignedToId,
//   department, source, capaType, overdueOnly, search, page, size, sortBy, sortDir }
export const getCapaSummaryApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/summary', { params: { filter } });

export const getCapaTableApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/table', { params: { filter } });

export const getCapaByStatusApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/by-status', { params: { filter } });

export const getCapaByPriorityApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/by-priority', { params: { filter } });

export const getCapaByDepartmentApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/by-department', { params: { filter } });

export const getCapaMonthlyTrendApi = (filter) =>
  apiClient.get('/api/v1/reports/capa/monthly-trend', { params: { filter } });

export const exportCapaExcelApi = (data) =>
  apiClient.post('/api/v1/reports/capa/export/excel', data, { responseType: 'blob' });

export const exportCapaPdfApi = (data) =>
  apiClient.post('/api/v1/reports/capa/export/pdf', data, { responseType: 'blob' });

// ── Deviation Reports ──────────────────────────────────────────────────────
export const getDeviationSummaryApi = (filter) =>
  apiClient.get('/api/v1/reports/deviations/summary', { params: { filter } });

export const getDeviationTableApi = (filter) =>
  apiClient.get('/api/v1/reports/deviations/table', { params: { filter } });

export const getDeviationByStatusApi = (filter) =>
  apiClient.get('/api/v1/reports/deviations/by-status', { params: { filter } });

export const getDeviationMonthlyTrendApi = (filter) =>
  apiClient.get('/api/v1/reports/deviations/monthly-trend', { params: { filter } });

export const exportDeviationExcelApi = (data) =>
  apiClient.post('/api/v1/reports/deviations/export/excel', data, { responseType: 'blob' });

// ── Incident Reports ───────────────────────────────────────────────────────
export const getIncidentSummaryApi = (filter) =>
  apiClient.get('/api/v1/reports/incidents/summary', { params: { filter } });

export const getIncidentTableApi = (filter) =>
  apiClient.get('/api/v1/reports/incidents/table', { params: { filter } });

export const getIncidentByTypeApi = (filter) =>
  apiClient.get('/api/v1/reports/incidents/by-type', { params: { filter } });

export const getIncidentBySeverityApi = (filter) =>
  apiClient.get('/api/v1/reports/incidents/by-severity', { params: { filter } });

export const getIncidentMonthlyTrendApi = (filter) =>
  apiClient.get('/api/v1/reports/incidents/monthly-trend', { params: { filter } });

export const exportIncidentExcelApi = (data) =>
  apiClient.post('/api/v1/reports/incidents/export/excel', data, { responseType: 'blob' });

// ── User Reports ───────────────────────────────────────────────────────────
export const getUsersByRoleApi = () =>
  apiClient.get('/api/v1/reports/users/by-role');

export const getUsersByDepartmentApi = () =>
  apiClient.get('/api/v1/reports/users/by-department');

export const getUserActivityTrendApi = (filter) =>
  apiClient.get('/api/v1/reports/users/activity-trend', { params: { filter } });

// ExportRequest: { format* (EXCEL|PDF), dateFrom, dateTo, statuses[], priorities[],
//   department, search, columns[], reportTitle, includeSummary, ... }
export const exportDashboardExcelApi = (data) =>
  apiClient.post('/api/v1/reports/dashboard/export/excel', data, { responseType: 'blob' });
