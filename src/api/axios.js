import axios from 'axios';
import { getToken, removeToken } from '../utils/helpers';
import { ROUTES } from '../utils/constants';

// All successful API calls return response.data where:
//   response.data.success       = true/false
//   response.data.data          = actual payload
//   response.data.data.content  = array (paginated responses)
//   response.data.data.totalElements = total count (paginated responses)

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach JWT to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 — only redirect to login when we truly have no valid session.
// 401 on a DATA endpoint while a token exists = Spring Security returning 401
// instead of 403 for insufficient permissions → don't logout, just reject.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const hasToken = !!getToken();

    // Only hard-redirect on 401 if:
    //   • we have no token (genuinely unauthenticated), OR
    //   • it's an auth/me endpoint (token confirmed invalid by the server)
    if (status === 401) {
      if (!hasToken || url.includes('/auth/me') || url.includes('/auth/login')) {
        removeToken();
        window.location.href = ROUTES.LOGIN;
      }
      // Otherwise: authenticated user hitting a locked endpoint → treat as 403, keep session
    }
    return Promise.reject(error);
  }
);

export default apiClient;
