import apiClient from './axios';

export const getUsersApi = (params) =>
  apiClient.get('/users', { params });

export const getUserByIdApi = (id) =>
  apiClient.get(`/users/${id}`);

export const createUserApi = (data) =>
  apiClient.post('/users', data);

export const updateUserApi = (id, data) =>
  apiClient.put(`/users/${id}`, data);

export const deleteUserApi = (id) =>
  apiClient.delete(`/users/${id}`);

export const updateUserStatusApi = (id, status) =>
  apiClient.patch(`/users/${id}/status`, { status });
