import apiClient from './axios';

// Any authenticated user
export const getActivePolicyApi = () =>
  apiClient.get('/api/v1/admin/password-policy/active');

// SUPER_ADMIN, QA_MANAGER
export const getAllPoliciesApi = () =>
  apiClient.get('/api/v1/admin/password-policy');

export const getPolicyByIdApi = (id) =>
  apiClient.get(`/api/v1/admin/password-policy/${id}`);

// SUPER_ADMIN only
export const createPolicyApi = (data) =>
  apiClient.post('/api/v1/admin/password-policy', data);

export const updatePolicyApi = (id, data) =>
  apiClient.put(`/api/v1/admin/password-policy/${id}`, data);

export const deletePolicyApi = (id) =>
  apiClient.delete(`/api/v1/admin/password-policy/${id}`);
