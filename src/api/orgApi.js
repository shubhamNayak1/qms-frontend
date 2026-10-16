import apiClient from './axios';

// ── Site (singleton) ────────────────────────────────────────
export const getSiteApi = () =>
  apiClient.get('/api/v1/org/site');

// SiteRequest: { name, code, address, headUserId }
export const updateSiteApi = (id, data) =>
  apiClient.put(`/api/v1/org/site/${id}`, data);

// ── Departments ─────────────────────────────────────────────
export const listDepartmentsApi = () =>
  apiClient.get('/api/v1/org/departments');

export const getDepartmentApi = (id) =>
  apiClient.get(`/api/v1/org/departments/${id}`);

// DepartmentRequest: { name, code, description, siteId, parentId, hodUserId, deptType }
export const createDepartmentApi = (data) =>
  apiClient.post('/api/v1/org/departments', data);

export const updateDepartmentApi = (id, data) =>
  apiClient.put(`/api/v1/org/departments/${id}`, data);

// Toggle isActive on a department. Preferred over hard delete — the row
// stays in the DB so historical QMS records keep resolving its name.
export const setDepartmentActiveApi = (id, active) =>
  apiClient.patch(`/api/v1/org/departments/${id}/active`, null, {
    params: { active },
  });

// ── Org Tree (top-down nested) ──────────────────────────────
export const getOrgTreeApi = () =>
  apiClient.get('/api/v1/org/tree');
