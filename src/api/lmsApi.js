import apiClient from './axios';

// ── Training Programs ──────────────────────────────────────────────────────
// GET params: status (DRAFT/ACTIVE/ARCHIVED), category, department, mandatory, search, page, size
export const getProgramsApi = (params) =>
  apiClient.get('/api/v1/lms/programs', { params });

export const getProgramByIdApi = (id) =>
  apiClient.get(`/api/v1/lms/programs/${id}`);

export const getProgramByCodeApi = (code) =>
  apiClient.get(`/api/v1/lms/programs/code/${code}`);

// ProgramRequest: { code*, title*, description, category, department, tags, status,
//   isMandatory, estimatedDurationMinutes, certificateValidityYears,
//   completionDeadlineDays, assessmentRequired, passScore, maxAttempts, ownerId }
export const createProgramApi = (data) =>
  apiClient.post('/api/v1/lms/programs', data);

export const updateProgramApi = (id, data) =>
  apiClient.put(`/api/v1/lms/programs/${id}`, data);

export const deleteProgramApi = (id) =>
  apiClient.delete(`/api/v1/lms/programs/${id}`);

export const publishProgramApi = (id) =>
  apiClient.post(`/api/v1/lms/programs/${id}/publish`);

export const archiveProgramApi = (id) =>
  apiClient.post(`/api/v1/lms/programs/${id}/archive`);

// ── Enrollments ────────────────────────────────────────────────────────────
// GET params: userId, programId, status, department, overdue, page, size
export const getEnrollmentsApi = (params) =>
  apiClient.get('/api/v1/lms/enrollments', { params });

export const getMyEnrollmentsApi = () =>
  apiClient.get('/api/v1/lms/enrollments/my');

export const getEnrollmentByIdApi = (id) =>
  apiClient.get(`/api/v1/lms/enrollments/${id}`);

// EnrollmentRequest: { userId*, programId*, dueDate, assignmentReason }
export const enrollUserApi = (data) =>
  apiClient.post('/api/v1/lms/enrollments', data);

// BulkEnrollmentRequest: { programId, userIds: [], dueDate, assignmentReason }
export const bulkEnrollApi = (data) =>
  apiClient.post('/api/v1/lms/enrollments/bulk', data);

export const cancelEnrollmentApi = (id, reason) =>
  apiClient.post(`/api/v1/lms/enrollments/${id}/cancel`, null, { params: { reason } });

// WaiverRequest: { reason* }
export const waiveEnrollmentApi = (id, data) =>
  apiClient.post(`/api/v1/lms/enrollments/${id}/waive`, data);

// ContentProgressRequest: { contentId*, viewPercent, acknowledged, sessionTimeSeconds }
export const updateProgressApi = (id, data) =>
  apiClient.post(`/api/v1/lms/enrollments/${id}/progress`, data);

// ── Certificates ───────────────────────────────────────────────────────────
export const getCertificatesByUserApi = (userId, params) =>
  apiClient.get(`/api/v1/lms/certificates/user/${userId}`, { params });

export const getCertificateByNumberApi = (certificateNumber) =>
  apiClient.get(`/api/v1/lms/certificates/number/${certificateNumber}`);

export const getCertificateByEnrollmentApi = (enrollmentId) =>
  apiClient.get(`/api/v1/lms/certificates/enrollment/${enrollmentId}`);

export const revokeCertificateApi = (id, reason) =>
  apiClient.post(`/api/v1/lms/certificates/${id}/revoke`, null, { params: { reason } });

// ── Compliance Dashboard ───────────────────────────────────────────────────
export const getLmsComplianceDashboardApi = () =>
  apiClient.get('/api/v1/lms/compliance/dashboard');
