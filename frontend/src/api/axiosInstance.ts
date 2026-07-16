// src/api/axiosInstance.ts
import axios from 'axios';

// API Gateway URL - use Vite proxy or relative path by default
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor: Auto-attach JWT token to all requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Debugging helper: log outgoing requests and token presence in development
if (import.meta.env.DEV) {
  axiosInstance.interceptors.request.use((config) => {
    try {
      const token = localStorage.getItem('authToken');
      const maskedLocal = token ? `${token.slice(0,8)}...${token.slice(-8)}` : 'null';
      // Also inspect header as attached to the config (if present)
      const headerAuth = config.headers?.Authorization || config.headers?.authorization || null;
      let maskedHeader = 'null';
      if (headerAuth && typeof headerAuth === 'string') {
        const tokenOnly = headerAuth.replace(/^Bearer\s+/i, '');
        maskedHeader = tokenOnly ? `${tokenOnly.slice(0,8)}...${tokenOnly.slice(-8)}` : 'null';
      }
      // eslint-disable-next-line no-console
      console.debug('[axios] Outgoing request', config.method, config.url, 'localStorage token:', maskedLocal, 'Authorization header:', maskedHeader);
    } catch (e) {
      // ignore
    }
    return config;
  });
}

// Response interceptor: Handle general errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    // If no response or not a 401, reject
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Prevent infinite loop
    if (originalRequest._retry) {
      // Clear tokens and reject
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      localStorage.removeItem('authToken');
      return Promise.reject(error);
    }

    // Attempt to refresh token
    return axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const newToken = res.data?.token;
        const newRefresh = res.data?.refreshToken;
        if (newToken) {
          localStorage.setItem('authToken', newToken);
        }
        if (newRefresh) {
          localStorage.setItem('refreshToken', newRefresh);
        }
        // Update the original request Authorization header and retry
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      })
      .catch((refreshError) => {
        // Refresh failed - clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        return Promise.reject(refreshError);
      });
  }
);

export default axiosInstance;