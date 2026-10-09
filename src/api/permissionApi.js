import apiClient from './axios';

// Permission catalogue
export const getAllPermissionsFlatApi = () =>
  apiClient.get('/api/v1/permissions/all');

// Per-user override endpoints (see UserPermissionController)
export const listUserOverridesApi = (userId) =>
  apiClient.get(`/api/v1/users/${userId}/permission-overrides`);

// body: { permissionId, grantType: 'GRANT' | 'REVOKE', reason? }
export const upsertUserOverrideApi = (userId, data) =>
  apiClient.put(`/api/v1/users/${userId}/permission-overrides`, data);

export const removeUserOverrideApi = (userId, permissionId) =>
  apiClient.delete(`/api/v1/users/${userId}/permission-overrides/${permissionId}`);
