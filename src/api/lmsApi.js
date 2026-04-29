import apiClient from './axios';

// ── Programs ──────────────────────────────────────────────────────────────────
export const getProgramsApi      = (params)    => apiClient.get('/api/v1/lms/programs', { params });
export const getProgramByIdApi   = (id)        => apiClient.get(`/api/v1/lms/programs/${id}`);
export const getProgramByCodeApi = (code)      => apiClient.get(`/api/v1/lms/programs/code/${code}`);
export const createProgramApi    = (data)      => apiClient.post('/api/v1/lms/programs', data);
export const updateProgramApi    = (id, data)  => apiClient.put(`/api/v1/lms/programs/${id}`, data);
export const deleteProgramApi    = (id)        => apiClient.delete(`/api/v1/lms/programs/${id}`);

// Program workflow transitions
export const raiseReviewApi   = (id)         => apiClient.post(`/api/v1/lms/programs/${id}/raise-review`);
export const approveProgramApi= (id)         => apiClient.post(`/api/v1/lms/programs/${id}/approve`);
export const rejectProgramApi = (id, reason) => apiClient.post(`/api/v1/lms/programs/${id}/reject`, null, { params: { reason } });
export const planProgramApi   = (id)         => apiClient.post(`/api/v1/lms/programs/${id}/plan`);
export const activateProgramApi= (id)        => apiClient.post(`/api/v1/lms/programs/${id}/activate`);
export const completeProgramApi= (id)        => apiClient.post(`/api/v1/lms/programs/${id}/complete`);
export const archiveProgramApi = (id)        => apiClient.post(`/api/v1/lms/programs/${id}/archive`);

// Program contents
export const addProgramContentApi    = (id, params)            => apiClient.post(`/api/v1/lms/programs/${id}/contents`, null, { params });
export const deleteProgramContentApi = (id, contentId)         => apiClient.delete(`/api/v1/lms/programs/${id}/contents/${contentId}`);

// Program document links
export const addDocumentLinkApi    = (id, params) => apiClient.post(`/api/v1/lms/programs/${id}/document-links`, null, { params });
export const deleteDocumentLinkApi = (id, linkId) => apiClient.delete(`/api/v1/lms/programs/${id}/document-links/${linkId}`);

// ── Sessions ──────────────────────────────────────────────────────────────────
export const getProgramSessionsApi = (programId)        => apiClient.get(`/api/v1/lms/programs/${programId}/sessions`);
export const createSessionApi      = (programId, data)  => apiClient.post(`/api/v1/lms/programs/${programId}/sessions`, data);
export const getSessionByIdApi     = (sessionId)        => apiClient.get(`/api/v1/lms/sessions/${sessionId}`);
export const updateSessionApi      = (sessionId, data)  => apiClient.put(`/api/v1/lms/sessions/${sessionId}`, data);
export const cancelSessionApi      = (sessionId, reason)=> apiClient.post(`/api/v1/lms/sessions/${sessionId}/cancel`, null, { params: { reason } });
export const completeSessionApi    = (sessionId)        => apiClient.post(`/api/v1/lms/sessions/${sessionId}/complete`);
export const markAttendanceApi     = (sessionId, data)  => apiClient.post(`/api/v1/lms/sessions/${sessionId}/attendance`, data);

// ── Enrollments ───────────────────────────────────────────────────────────────
export const getEnrollmentsApi      = (params)          => apiClient.get('/api/v1/lms/enrollments', { params });
export const getMyEnrollmentsApi    = ()                => apiClient.get('/api/v1/lms/enrollments/my');
export const getEnrollmentByIdApi   = (id)              => apiClient.get(`/api/v1/lms/enrollments/${id}`);
export const enrollUserApi          = (data)            => apiClient.post('/api/v1/lms/enrollments', data);
export const bulkEnrollApi          = (data)            => apiClient.post('/api/v1/lms/enrollments/bulk', data);
export const approveAllocationApi   = (programId)       => apiClient.post(`/api/v1/lms/enrollments/programs/${programId}/approve-allocation`);
export const updateProgressApi      = (id, data)        => apiClient.post(`/api/v1/lms/enrollments/${id}/progress`, data);
export const waiveEnrollmentApi     = (id, data)        => apiClient.post(`/api/v1/lms/enrollments/${id}/waive`, data);
export const cancelEnrollmentApi    = (id, reason)      => apiClient.post(`/api/v1/lms/enrollments/${id}/cancel`, null, { params: { reason } });

// ── Compliance ────────────────────────────────────────────────────────────────
export const submitComplianceApi    = (enrollmentId, data) => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/compliance/submit`, data);
export const getComplianceApi       = (enrollmentId)       => apiClient.get(`/api/v1/lms/enrollments/${enrollmentId}/compliance`);
export const reviewComplianceApi    = (enrollmentId, data) => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/compliance/review`, data);
export const hrReviewComplianceApi  = (enrollmentId, data) => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/compliance/hr-review`, data);
export const qaApproveComplianceApi = (enrollmentId, data) => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/compliance/qa-approve`, data);
export const getPendingComplianceApi= (enrollmentId)       => apiClient.get(`/api/v1/lms/enrollments/${enrollmentId}/compliance/pending`);

// ── Assessments ───────────────────────────────────────────────────────────────
export const startAssessmentApi            = (enrollmentId)              => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/assessment/start`);
export const submitAssessmentApi           = (enrollmentId, data)        => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/assessment/submit`, data);
export const getAssessmentAttemptsApi      = (enrollmentId)              => apiClient.get(`/api/v1/lms/enrollments/${enrollmentId}/assessment/attempts`);
export const reviewAssessmentApi           = (enrollmentId, attemptId, data) => apiClient.post(`/api/v1/lms/enrollments/${enrollmentId}/assessment/review/${attemptId}`, data);
export const getPendingAssessmentReviewsApi= (enrollmentId)              => apiClient.get(`/api/v1/lms/enrollments/${enrollmentId}/assessment/pending-reviews`);

// ── TNI ───────────────────────────────────────────────────────────────────────
export const getTniByEnrollmentApi = (enrollmentId) => apiClient.get(`/api/v1/lms/tni/enrollment/${enrollmentId}`);
export const getTniByUserApi       = (userId)       => apiClient.get(`/api/v1/lms/tni/user/${userId}`);
export const updateTniApi          = (enrollmentId, data) => apiClient.put(`/api/v1/lms/tni/enrollment/${enrollmentId}`, data);

// ── Certificates ──────────────────────────────────────────────────────────────
export const getCertificatesByUserApi      = (userId)            => apiClient.get(`/api/v1/lms/certificates/user/${userId}`);
export const getCertificateByNumberApi     = (certificateNumber) => apiClient.get(`/api/v1/lms/certificates/number/${certificateNumber}`);
export const getCertificateByEnrollmentApi = (enrollmentId)      => apiClient.get(`/api/v1/lms/certificates/enrollment/${enrollmentId}`);
export const revokeCertificateApi          = (id)                => apiClient.post(`/api/v1/lms/certificates/${id}/revoke`);

// ── Compliance Dashboard ──────────────────────────────────────────────────────
export const getLmsComplianceDashboardApi = () => apiClient.get('/api/v1/lms/compliance/dashboard');
