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

export const deleteDepartmentApi = (id) =>
  apiClient.delete(`/api/v1/org/departments/${id}`);

// ── Org Tree (top-down nested) ──────────────────────────────
export const getOrgTreeApi = () =>
  apiClient.get('/api/v1/org/tree');
