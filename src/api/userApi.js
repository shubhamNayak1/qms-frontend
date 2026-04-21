import apiClient from './axios';

// GET /api/v1/users?search=&department=&isActive=&page=0&size=20
export const getUsersApi = (params) =>
  apiClient.get('/api/v1/users', { params });

export const getUserByIdApi = (id) =>
  apiClient.get(`/api/v1/users/${id}`);

// CreateUserRequest: { username, email, password, firstName, lastName, phone, department, designation, employeeId, roleIds }
export const createUserApi = (data) =>
  apiClient.post('/api/v1/users', data);

// UpdateUserRequest: { firstName, lastName, phone, department, designation, employeeId, profilePictureUrl, isActive }
export const updateUserApi = (id, data) =>
  apiClient.put(`/api/v1/users/${id}`, data);

export const deleteUserApi = (id) =>
  apiClient.delete(`/api/v1/users/${id}`);

// AssignRolesRequest: { roleIds: [1,2] }
export const assignRolesApi = (id, roleIds) =>
  apiClient.patch(`/api/v1/users/${id}/roles`, { roleIds });

export const activateUserApi = (id) =>
  apiClient.patch(`/api/v1/users/${id}/activate`);

export const deactivateUserApi = (id) =>
  apiClient.patch(`/api/v1/users/${id}/deactivate`);

// ChangePasswordRequest: { currentPassword, newPassword, confirmPassword }
export const changePasswordApi = (id, data) =>
  apiClient.patch(`/api/v1/users/${id}/change-password`, data);
