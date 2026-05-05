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

/**
 * Cross-module handoff: spawn a Deviation from this Incident.
 * Only valid on General Incidents flagged deviationRequired = true and
 * currently at PENDING_QA_REVIEW. Returns the updated Incident with
 * spawnedDeviationId / spawnedDeviationNumber populated; the Incident's
 * status flips to DEVIATION_SPAWNED.
 */
export const spawnDeviationFromIncidentApi = (id, comment) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/spawn-deviation`, null, { params: { comment } });

// ── Cross-module CAPA spawn — one endpoint per parent module ─────────────
// Each returns the new CapaResponse (or the parent's response in the CC case)
// and stamps the CAPA's record number on the parent's linked_capa_number /
// capa_reference field. Idempotent — repeated calls return the existing link.
export const spawnCapaFromIncidentApi = (id, preliminaryInvestigation) =>
  apiClient.post(`/api/v1/qms/incidents/${id}/spawn-capa`, null,
                 { params: { preliminaryInvestigation } });

export const spawnCapaFromDeviationApi = (id, preliminaryInvestigation) =>
  apiClient.post(`/api/v1/qms/deviations/${id}/spawn-capa`, null,
                 { params: { preliminaryInvestigation } });

export const spawnCapaFromChangeControlApi = (id, preliminaryInvestigation) =>
  apiClient.post(`/api/v1/qms/change-controls/${id}/spawn-capa`, null,
                 { params: { preliminaryInvestigation } });

export const spawnCapaFromComplaintApi = (id, preliminaryInvestigation) =>
  apiClient.post(`/api/v1/qms/complaints/${id}/spawn-capa`, null,
                 { params: { preliminaryInvestigation } });

// ── CAPA effectiveness-assessment endpoints (post-closure) ───────────────
export const listCapaAssessmentsApi = (capaId) =>
  apiClient.get(`/api/v1/qms/capa/${capaId}/assessments`);

// QmsCapaAssessmentRequest: { actionObserved, evidenceRef, isEffective }
export const submitCapaAssessmentApi = (rowId, data) =>
  apiClient.put(`/api/v1/qms/capa/assessments/${rowId}`, data);

// QmsCapaAssessmentReviewRequest: { decision: ACCEPTED|REJECTED, comment }
export const reviewCapaAssessmentApi = (rowId, data) =>
  apiClient.post(`/api/v1/qms/capa/assessments/${rowId}/review`, data);

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
