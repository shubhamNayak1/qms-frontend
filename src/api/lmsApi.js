import apiClient from './axios';

export const getCoursesApi = (params) =>
  apiClient.get('/lms/courses', { params });

export const getCourseByIdApi = (id) =>
  apiClient.get(`/lms/courses/${id}`);

export const createCourseApi = (data) =>
  apiClient.post('/lms/courses', data);

export const updateCourseApi = (id, data) =>
  apiClient.put(`/lms/courses/${id}`, data);

export const getEnrollmentsApi = (params) =>
  apiClient.get('/lms/enrollments', { params });

export const enrollUserApi = (data) =>
  apiClient.post('/lms/enrollments', data);

export const getTrainingRecordsApi = (params) =>
  apiClient.get('/lms/training-records', { params });
