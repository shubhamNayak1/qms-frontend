import apiClient from './axios';

export const getDashboardStatsApi = () =>
  apiClient.get('/reports/dashboard-stats');

export const getQmsReportApi = (params) =>
  apiClient.get('/reports/qms', { params });

export const getDmsReportApi = (params) =>
  apiClient.get('/reports/dms', { params });

export const getLmsReportApi = (params) =>
  apiClient.get('/reports/lms', { params });

export const exportReportApi = (type, params) =>
  apiClient.get(`/reports/export/${type}`, {
    params,
    responseType: 'blob',
  });
