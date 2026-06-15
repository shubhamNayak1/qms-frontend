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

export const changePasswordApi = (userId, data) =>
  apiClient.patch(`/api/v1/users/${userId}/change-password`, data);
// ChangePasswordRequest: { currentPassword, newPassword, confirmPassword }

// 21 CFR Part 11 e-signature gate (Round-2 E3) — verifies the current user's
// password before a QMS workflow transition. Server logs the verification
// on the audit_log and returns 204 No Content on success.
//   ESignRequest: { username, password, meaning }
export const eSignApi = (data) =>
  apiClient.post('/api/v1/auth/e-sign', data);
