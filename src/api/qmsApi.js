import apiClient from './axios';


// ── CAPA ──────────────────────────────────────────────────────────────────
// GET params: status, priority, assignedTo, department, source, search, page, size
export const getCapasApi = (params) =>
  apiClient.get('/api/v1/qms/capa', { params });

export const getCapaByIdApi = (id) =>
  apiClient.get(`/api/v1/qms/capa/${id}`);

// CapaRequest: { title*, priority*, description, assignedToId, department, dueDate,
//   targetCompletionDate, rootCause, correctiveAction, comments,
//   source, capaType, preventiveAction, effectivenessCheckDate, linkedDeviationNumber }
export const createCapaApi = (data) =>
  apiClient.post('/api/v1/qms/capa', data);

export const updateCapaApi = (id, data) =>
  apiClient.put(`/api/v1/qms/capa/${id}`, data);

export const deleteCapaApi = (id) =>
  apiClient.delete(`/api/v1/qms/capa/${id}`);

export const submitCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/submit`, null, { params: { comment } });

export const approveCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/approve`, null, { params: { comment } });

export const rejectCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/reject`, null, { params: { comment } });

export const closeCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/close`, null, { params: { comment } });

export const cancelCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/cancel`, null, { params: { comment } });

export const reopenCapaApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/capa/${id}/reopen`, null, { params: { comment } });

// WorkflowRequest: { targetStatus, comment }
export const transitionCapaApi = (id, data) =>
  apiClient.post(`/api/v1/qms/capa/${id}/transition`, data);

// EffectivenessRequest: { isEffective, effectivenessResult }
export const recordEffectivenessApi = (id, data) =>
  apiClient.post(`/api/v1/qms/capa/${id}/effectiveness`, data);

// ── Deviation ─────────────────────────────────────────────────────────────
// GET params: status, priority, assignedTo, department, deviationType, search, page, size
export const getDeviationsApi = (params) =>
  apiClient.get('/api/v1/qms/deviations', { params });

export const getDeviationByIdApi = (id) =>
  apiClient.get(`/api/v1/qms/deviations/${id}`);

// DeviationRequest: { title*, priority*, description, assignedToId, department, dueDate,
//   targetCompletionDate, rootCause, correctiveAction, comments,
//   deviationType, productBatch, processArea, impactAssessment,
//   capaRequired, capaReference, regulatoryReportable }
export const createDeviationApi = (data) =>
  apiClient.post('/api/v1/qms/deviations', data);

export const updateDeviationApi = (id, data) =>
  apiClient.put(`/api/v1/qms/deviations/${id}`, data);

export const deleteDeviationApi = (id) =>
  apiClient.delete(`/api/v1/qms/deviations/${id}`);

export const submitDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/submit`, null, { params: { comment } });

export const approveDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/approve`, null, { params: { comment } });

export const rejectDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/reject`, null, { params: { comment } });

export const closeDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/close`, null, { params: { comment } });

export const cancelDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/cancel`, null, { params: { comment } });

export const reopenDeviationApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/reopen`, null, { params: { comment } });

export const transitionDeviationApi = (id, data) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/transition`, data);

// ── Incident ──────────────────────────────────────────────────────────────
// GET params: status, priority, severity, incidentType, assignedTo, department, search, page, size
export const getIncidentsApi = (params) =>
  apiClient.get('/api/v1/qms/incidents', { params });

export const getIncidentByIdApi = (id) =>
  apiClient.get(`/api/v1/qms/incidents/${id}`);

// IncidentRequest: { title*, priority*, description, assignedToId, department, dueDate,
//   incidentType, severity, location, occurrenceDate, reportedBy,
//   immediateAction, investigationDetails, capaReference,
//   injuryInvolved, injuryDetails }
export const createIncidentApi = (data) =>
  apiClient.post('/api/v1/qms/incidents', data);

export const updateIncidentApi = (id, data) =>
  apiClient.put(`/api/v1/qms/incidents/${id}`, data);

export const deleteIncidentApi = (id) =>
  apiClient.delete(`/api/v1/qms/incidents/${id}`);

export const submitIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/submit`, null, { params: { comment } });

export const approveIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/approve`, null, { params: { comment } });

export const rejectIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/reject`, null, { params: { comment } });

export const closeIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/close`, null, { params: { comment } });

export const cancelIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/cancel`, null, { params: { comment } });

export const reopenIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/reopen`, null, { params: { comment } });

export const transitionIncidentApi = (id, data) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/transition`, data);

// ── Market Complaint ───────────────────────────────────────────────────────
// GET params: status, priority, category, assignedTo, reportableOnly, search, page, size
export const getComplaintsApi = (params) =>
  apiClient.get('/api/v1/qms/complaints', { params });

export const getComplaintByIdApi = (id) =>
  apiClient.get(`/api/v1/qms/complaints/${id}`);

// MarketComplaintRequest: { title*, priority*, description, assignedToId, department, dueDate,
//   customerName, customerContact, customerCountry, productName, batchNumber,
//   expiryDate, complaintCategory, complaintSource, receivedDate,
//   reportableToAuthority, resolutionDetails, capaReference, sampleReturned }
export const createComplaintApi = (data) =>
  apiClient.post('/api/v1/qms/complaints', data);

export const updateComplaintApi = (id, data) =>
  apiClient.put(`/api/v1/qms/complaints/${id}`, data);

export const deleteComplaintApi = (id) =>
  apiClient.delete(`/api/v1/qms/complaints/${id}`);

export const submitComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/submit`, null, { params: { comment } });

export const approveComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/approve`, null, { params: { comment } });

export const rejectComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/reject`, null, { params: { comment } });

export const closeComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/close`, null, { params: { comment } });

export const cancelComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/cancel`, null, { params: { comment } });

export const reopenComplaintApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/reopen`, null, { params: { comment } });

export const transitionComplaintApi = (id, data) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/transition`, data);

// ── Change Control ────────────────────────────────────────────────────────
// GET params: status, priority, changeType, riskLevel, assignedTo, department, search, page, size
export const getChangeControlsApi = (params) =>
  apiClient.get('/api/v1/qms/change-controls', { params });

export const getChangeControlByIdApi = (id) =>
  apiClient.get(`/api/v1/qms/change-controls/${id}`);

// ChangeControlRequest: { title*, priority*, description, assignedToId, department, dueDate,
//   changeType, changeReason, riskLevel, riskAssessment, implementationPlan,
//   implementationDate, validationRequired, validationDetails,
//   regulatorySubmissionRequired, rollbackPlan }
export const createChangeControlApi = (data) =>
  apiClient.post('/api/v1/qms/change-controls', data);

export const updateChangeControlApi = (id, data) =>
  apiClient.put(`/api/v1/qms/change-controls/${id}`, data);

export const deleteChangeControlApi = (id) =>
  apiClient.delete(`/api/v1/qms/change-controls/${id}`);

export const submitChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/submit`, null, { params: { comment } });

export const approveChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/approve`, null, { params: { comment } });

export const rejectChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/reject`, null, { params: { comment } });

export const closeChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/close`, null, { params: { comment } });

export const cancelChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/cancel`, null, { params: { comment } });

export const reopenChangeControlApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/reopen`, null, { params: { comment } });

export const transitionChangeControlApi = (id, data) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/transition`, data);

// ── QMS Dashboard ─────────────────────────────────────────────────────────
export const getQmsDashboardApi = () =>
  apiClient.get('/api/v1/qms/dashboard');
