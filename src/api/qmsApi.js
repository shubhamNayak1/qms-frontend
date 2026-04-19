import apiClient from './axios';

export const getNonConformancesApi = (params) =>
  apiClient.get('/qms/non-conformances', { params });

export const getNonConformanceByIdApi = (id) =>
  apiClient.get(`/qms/non-conformances/${id}`);

export const createNonConformanceApi = (data) =>
  apiClient.post('/qms/non-conformances', data);

export const updateNonConformanceApi = (id, data) =>
  apiClient.put(`/qms/non-conformances/${id}`, data);

export const getAuditsApi = (params) =>
  apiClient.get('/qms/audits', { params });

export const createAuditApi = (data) =>
  apiClient.post('/qms/audits', data);

export const getCorrectiveActionsApi = (params) =>
  apiClient.get('/qms/corrective-actions', { params });
