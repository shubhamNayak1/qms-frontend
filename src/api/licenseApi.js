import apiClient from './axios';

// status: AVAILABLE | ASSIGNED | REVOKED | EXPIRED (optional)
export const listLicensesApi = (params) =>
  apiClient.get('/api/v1/licenses', { params });

export const getLicenseStatsApi = () =>
  apiClient.get('/api/v1/licenses/stats');

// GenerateLicensesRequest: { count, expiresAt, notes }
export const generateLicensesApi = (data) =>
  apiClient.post('/api/v1/licenses/generate', data);

// AssignLicenseRequest: { userId }
export const assignLicenseApi = (licenseId, userId) =>
  apiClient.post(`/api/v1/licenses/${licenseId}/assign`, { userId });

export const revokeLicenseApi = (licenseId, reason) =>
  apiClient.post(`/api/v1/licenses/${licenseId}/revoke`, null, {
    params: reason ? { reason } : undefined,
  });
