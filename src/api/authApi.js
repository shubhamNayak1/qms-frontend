import apiClient from './axios';

export const loginApi = (credentials) =>
  apiClient.post('/auth/login', credentials);

export const logoutApi = () =>
  apiClient.post('/auth/logout');

export const getMeApi = () =>
  apiClient.get('/auth/me');

export const refreshTokenApi = () =>
  apiClient.post('/auth/refresh');
