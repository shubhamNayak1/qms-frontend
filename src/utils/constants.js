export const TOKEN_KEY = 'qms_token';
export const USER_KEY = 'qms_user';

export const ROUTES = {
  LOGIN: '/login',
  CHANGE_PASSWORD: '/change-password',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  ORG: '/org',
  ORG_TREE:        '/org/tree',
  ORG_DEPARTMENTS: '/org/departments',
  ORG_SITE:        '/org/site',
  LICENSES: '/licenses',
  QMS: '/qms',
  QMS_CAPA:             '/qms/capa',
  QMS_DEVIATION:        '/qms/deviation',
  QMS_INCIDENT:         '/qms/incident',
  QMS_MARKET_COMPLAINT: '/qms/market-complaint',
  QMS_CHANGE_CONTROL:   '/qms/change-control',
  DMS: '/dms',
  LMS: '/lms',
  LMS_PROGRAMS:     '/lms/programs',
  LMS_ENROLLMENTS:  '/lms/enrollments',
  LMS_COMPLIANCE:   '/lms/compliance',
  LMS_CERTIFICATES: '/lms/certificates',
  REPORTS: '/reports',
  AUDIT: '/audit',
};

/**
 * Department type — mirrors the backend DepartmentType enum.
 * Drives QMS workflow gating: QA = central reviewer, RA = regulatory.
 */
export const DEPARTMENT_TYPES = ['QA', 'RA', 'STANDARD'];

export const LICENSE_STATUS = ['AVAILABLE', 'ASSIGNED', 'REVOKED', 'EXPIRED'];

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
};
