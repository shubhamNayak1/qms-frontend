import apiClient from './axios';

export const getDocumentsApi = (params) =>
  apiClient.get('/dms/documents', { params });

export const getDocumentByIdApi = (id) =>
  apiClient.get(`/dms/documents/${id}`);

export const uploadDocumentApi = (formData) =>
  apiClient.post('/dms/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateDocumentApi = (id, data) =>
  apiClient.put(`/dms/documents/${id}`, data);

export const deleteDocumentApi = (id) =>
  apiClient.delete(`/dms/documents/${id}`);

export const downloadDocumentApi = (id) =>
  apiClient.get(`/dms/documents/${id}/download`, { responseType: 'blob' });
