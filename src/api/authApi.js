import apiClient from './axios';

export const loginApi = (credentials) =>
  apiClient.post('/api/v1/auth/login', credentials);
// LoginRequest: { usernameOrEmail, password }

export const logoutApi = () =>
  apiClient.post('/api/v1/auth/logout');

export const refreshTokenApi = (refreshToken) =>
  apiClient.post('/api/v1/auth/refresh', { refreshToken });

export const forgotPasswordApi = (email) =>
  apiClient.post('/api/v1/auth/forgot-password', { email });

export const resetPasswordApi = (data) =>
  apiClient.post('/api/v1/auth/reset-password', data);
// ResetPasswordRequest: { token, newPassword, confirmPassword }

export const getMeApi = () =>
  apiClient.get('/api/v1/auth/me');
