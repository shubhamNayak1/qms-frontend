import apiClient from './axios';

export const getRolesApi = (params) =>
  apiClient.get('/api/v1/roles', { params });

export const getAllRolesFlatApi = () =>
  apiClient.get('/api/v1/roles/all');

export const getRoleByIdApi = (id) =>
  apiClient.get(`/api/v1/roles/${id}`);

// CreateRoleRequest: { name* (UPPER_SNAKE_CASE), displayName*, description, permissionIds[] }
export const createRoleApi = (data) =>
  apiClient.post('/api/v1/roles', data);

export const updateRoleApi = (id, data) =>
  apiClient.put(`/api/v1/roles/${id}`, data);

export const deleteRoleApi = (id) =>
  apiClient.delete(`/api/v1/roles/${id}`);

// AssignPermissionsRequest: { permissionIds: [] }
export const assignPermissionsApi = (id, permissionIds) =>
  apiClient.patch(`/api/v1/roles/${id}/permissions`, { permissionIds });
