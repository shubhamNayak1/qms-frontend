import apiClient from './axios';

// Lightweight — badge count only (poll frequently)
export const getNotificationCountApi = () =>
  apiClient.get('/api/v1/notifications/count');

// Full list + counts (only when panel is open)
export const getNotificationsApi = () =>
  apiClient.get('/api/v1/notifications');
